import { DefaultStackSynthesizer, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, ComputeType, LinuxArmBuildImage, Project } from 'aws-cdk-lib/aws-codebuild';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { CDK_VERSION, DEPLOYMENT_TABLE_NAME, GITHUB_DOMAIN, REPOSITORY_NAME, REPOSITORY_OWNER } from './configuration';
import { AddTenantFunction } from '../ddb-stream/add-tenant-function';

export class ToolchainStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const deploymentTable = new Table(this, 'deployment-table', {
      tableName: DEPLOYMENT_TABLE_NAME,
      partitionKey: {
        name: 'tenantID',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const installerImage = new Repository(this, 'nsa-installer', { repositoryName: 'nsa-installer' });
    // const githubInput = CodePipelineSource.gitHub(`${REPOSITORY_OWNER}/${REPOSITORY_NAME}`, 'main', {
    //   trigger: GitHubTrigger.NONE,
    //   authentication: SecretValue.secretsManager(REPOSITORY_SECRET, {
    //     jsonField: 'github_token',
    //   }),
    // });
    const ecrInput = CodePipelineSource.ecr(installerImage, { imageTag: 'latest' });
    const pipeline = new CodePipeline(this, 'cicd-pipeline', {
      pipelineName: 'Toolchain-CI-Pipeline',
      cliVersion: CDK_VERSION,
      selfMutation: true,
      synth: new CodeBuildStep('toolchain-synth', {
        input: ecrInput,
        buildEnvironment: {
          buildImage: LinuxArmBuildImage.fromEcrRepository(installerImage),
          computeType: ComputeType.SMALL,
        },
        commands: ['cd /app', 'yarn cdk synth --toolkit-stack-name nsl-CDKToolkit -q --verbose'],
        primaryOutputDirectory: '/app/cdk.out',
      }),
    });

    const updateDeploymentsRole = new Role(this, 'update-deployments-role', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      inlinePolicies: {
        'deployment-policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'codepipeline:StartPipelineExecution',
                'codepipeline:GetPipelineExecution',
                'codepipeline:GetPipelineState',
              ],
              resources: [
                'arn:aws:codepipeline:' + this.region + ':' + this.account + ':*-silo-pipeline',
                'arn:aws:codepipeline:' + this.region + ':' + this.account + ':*-pool-pipeline',
              ],
              effect: Effect.ALLOW,
            }),
            new PolicyStatement({
              actions: ['cloudformation:ListStacks'],
              effect: Effect.ALLOW,
              resources: ['*'],
            }),
            new PolicyStatement({
              actions: ['dynamodb:Query', 'dynamodb:Scan'],
              effect: Effect.ALLOW,
              resources: [deploymentTable.tableArn, deploymentTable.tableArn + '/index/*'],
            }),
            new PolicyStatement({
              actions: ['ec2:DescribeRegions'],
              effect: Effect.ALLOW,
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    pipeline.addWave('UpdateDeployments', {
      post: [
        new CodeBuildStep('update-deployments', {
          commands: ['cd /app', 'yarn ts-node bin/get-deployments.ts', 'yarn ts-node bin/update-deployments.ts'],
          buildEnvironment: {
            buildImage: LinuxArmBuildImage.fromEcrRepository(installerImage),
            computeType: ComputeType.SMALL,
          },
          role: updateDeploymentsRole,
        }),
      ],
    });

    // CodeBuild Project for Provisioning Build Job
    const project = new Project(this, 'provisioning-project', {
      projectName: 'provisioning-project',
      // source: Source.gitHub({
      //   owner: REPOSITORY_OWNER,
      //   repo: REPOSITORY_NAME,
      //   branchOrRef: 'refs/heads/main',
      // }),
      environment: {
        buildImage: LinuxArmBuildImage.fromEcrRepository(installerImage),
        computeType: ComputeType.SMALL,
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: ['cd /app', 'yarn ts-node bin/provision-deployment.ts'],
          },
        },
      }),
    });

    // Allow provision project to use CDK bootstrap roles. These are required when provision project runs CDK deploy
    project.addToRolePolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-deploy-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-file-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-image-publishing-role-${this.account}-${this.region}`,
        ],
        effect: Effect.ALLOW,
      }),
    );

    // Allow provision project to get AWS regions.
    // This is required for deployment information validation.
    project.addToRolePolicy(
      new PolicyStatement({
        actions: ['ec2:DescribeRegions'],
        effect: Effect.ALLOW,
        resources: ['*'],
      }),
    );

    // Lambda Function for DynamoDB Streams
    const streamTenant = new AddTenantFunction(this, 'add-tenant', {
      environment: {
        PROJECT_NAME: 'provisioning-project',
      },
    });

    streamTenant.role?.attachInlinePolicy(
      new Policy(this, 'start-pipeline-policy', {
        document: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [project.projectArn],
              actions: ['codebuild:StartBuild'],
            }),
          ],
        }),
      }),
    );

    streamTenant.addEventSource(
      new DynamoEventSource(deploymentTable, {
        startingPosition: StartingPosition.LATEST,
      }),
    );

    const ghProvider = new iam.OpenIdConnectProvider(this, 'githubProvider', {
      url: `https://${GITHUB_DOMAIN}`,
      clientIds: ['sts.amazonaws.com'],
    });

    const conditions: iam.Conditions = {
      StringLike: {
        [`${GITHUB_DOMAIN}:sub`]: `repo:${REPOSITORY_OWNER}/${REPOSITORY_NAME}:*`,
      },
    };

    const githubActionPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: [
            'ecr:BatchGetImage',
            'ecr:BatchCheckLayerAvailability',
            'ecr:CompleteLayerUpload',
            'ecr:GetDownloadUrlForLayer',
            'ecr:InitiateLayerUpload',
            'ecr:PutImage',
            'ecr:UploadLayerPart',
            'ecr:GetAuthorizationToken',
          ],
        }),
      ],
    });

    new iam.Role(this, 'gitHubSaasDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(ghProvider.openIdConnectProviderArn, conditions),
      roleName: 'gitHubSaasDeployRole',
      description: 'This role is used via GitHub Actions to deploy with AWS CDK or Terraform on the target AWS account',
      maxSessionDuration: Duration.hours(1),
      inlinePolicies: {
        githubAction: githubActionPolicy,
      },
    });
    new iam.WebIdentityPrincipal(ghProvider.openIdConnectProviderArn, conditions);
  }
}