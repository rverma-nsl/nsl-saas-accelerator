/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import TIER from '../stacks.json';

export interface DeploymentRecord {
  tenantId?: string; // callhealth
  id: string; // dev1, dev2, prod1, prod2
  type?: string; // can be pool or silo
  tier?: string; // small
  account?: string;
  region?: string;
}

export interface Deployment extends DeploymentRecord {
  provisioned?: boolean;
}
export function isValidTier(tierName: string): boolean {
  return TIER.some(tier => tier.name === tierName);
}

export function getPipelineName(record: DeploymentRecord): string {
  return `${record.tenantId}-${record.id}-${record.type}-pipeline`;
}
