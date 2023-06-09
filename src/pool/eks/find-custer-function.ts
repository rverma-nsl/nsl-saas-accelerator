// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for FindCusterFunction
 */
export interface FindCusterFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/pool/eks/find-custer.
 */
export class FindCusterFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: FindCusterFunctionProps) {
    super(scope, id, {
      description: 'src/pool/eks/find-custer.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs18.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../assets/pool/eks/find-custer.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}