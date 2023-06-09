import { ApplicationStage } from './application-stage';
import { DeploymentRecord } from '../common';
import { SaasPipeline } from '../constructs';

export function PipelineStack(pipeline: SaasPipeline, props: DeploymentRecord) {
  const devStage = new ApplicationStage(pipeline, 'Namespace', {
    env: { account: props.account, region: props.region }
  });
  const wave1 = pipeline.addWave('application');
  wave1.addStage(devStage);
}
