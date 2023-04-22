// ~~ Generated by projen. To modify, edit .projenrc.js and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for SecretGenFunction
 */
export interface SecretGenFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/aws-codecommit/secret-gen.
 */
export class SecretGenFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: SecretGenFunctionProps) {
    super(scope, id, {
      description: 'src/aws-codecommit/secret-gen.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs16.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../assets/aws-codecommit/secret-gen.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}