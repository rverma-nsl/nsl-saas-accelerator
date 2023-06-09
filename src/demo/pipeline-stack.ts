import { ApplicationStage } from './application-stage';
import { DeploymentRecord } from '../common';
import { SaasPipeline } from '../constructs';

export function PipelineStack(pipeline: SaasPipeline, props: DeploymentRecord) {
  const devStage = new ApplicationStage(pipeline, 'S3Site', { env: { account: props.account, region: props.region } });
  pipeline.addStage(devStage);
}
