import * as yaml from 'js-yaml';
import * as path from 'path';
import { ParsedFile, ParsedSymbol, ParsedImport, NodeType } from '../types';

export interface K8sResource {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  filePath: string;
  line: number;
  references: K8sReference[];
  raw: Record<string, unknown>;
}

export interface K8sReference {
  targetKind: string;
  targetName: string;
  relationship: K8sRelationship;
  field: string;
}

export type K8sRelationship =
  | 'deploys'
  | 'exposes'
  | 'configures'
  | 'mounts'
  | 'selects'
  | 'targets'
  | 'contains'
  | 'syncs'
  | 'triggers'
  | 'depends'
  | 'inherits'
  | 'references';

const K8S_CORE_KINDS = new Set([
  'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob',
  'Pod', 'Service', 'Ingress', 'ConfigMap', 'Secret',
  'PersistentVolume', 'PersistentVolumeClaim',
  'Namespace', 'ServiceAccount', 'Role', 'ClusterRole',
  'RoleBinding', 'ClusterRoleBinding', 'NetworkPolicy',
  'HorizontalPodAutoscaler', 'PodDisruptionBudget',
  'LimitRange', 'ResourceQuota',
]);

const ARGO_KINDS = new Set([
  'Application', 'ApplicationSet', 'AppProject',
  'Workflow', 'WorkflowTemplate', 'CronWorkflow', 'ClusterWorkflowTemplate',
  'Rollout', 'AnalysisTemplate', 'AnalysisRun', 'Experiment',
  'EventSource', 'Sensor', 'EventBus',
]);

const HELM_INDICATORS = [
  '{{ ', '{{- ', '.Values.', '.Release.', '.Chart.',
  'include "', 'template "', 'define "',
];

export class YamlParser {
  parseFile(filePath: string, content: string): ParsedFile {
    const resources = this.extractResources(filePath, content);
    const symbols: ParsedSymbol[] = [];
    const imports: ParsedImport[] = [];

    for (const res of resources) {
      symbols.push({
        name: res.name,
        type: this.kindToNodeType(res.kind),
        line: res.line,
        column: 0,
        exported: true,
        calls: res.references.map(r => `${r.targetKind}/${r.targetName}`),
      });

      for (const ref of res.references) {
        imports.push({
          source: `${ref.targetKind}/${ref.targetName}`,
          specifiers: [ref.relationship],
          isDefault: false,
          isDynamic: false,
          line: res.line,
        });
      }
    }

    const exports = symbols.filter(s => s.exported).map(s => s.name);

    return { filePath, imports, symbols, exports };
  }

  extractResources(filePath: string, content: string): K8sResource[] {
    const resources: K8sResource[] = [];
    const isHelm = this.isHelmTemplate(content, filePath);
    const cleanContent = isHelm ? this.stripHelmTemplating(content) : content;

    const documents = this.splitYamlDocuments(cleanContent);

    for (const { text, startLine } of documents) {
      try {
        const doc = yaml.load(text) as Record<string, unknown> | null;
        if (!doc || typeof doc !== 'object') { continue; }
        if (!this.isK8sManifest(doc)) { continue; }

        const resource = this.parseResource(doc, filePath, startLine);
        if (resource) {
          resources.push(resource);
        }
      } catch {
        // invalid YAML document, skip
      }
    }

    return resources;
  }

  private splitYamlDocuments(content: string): { text: string; startLine: number }[] {
    const docs: { text: string; startLine: number }[] = [];
    const lines = content.split('\n');
    let currentLines: string[] = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (currentLines.length > 0) {
          const text = currentLines.join('\n');
          if (text.trim()) {
            docs.push({ text, startLine });
          }
        }
        currentLines = [];
        startLine = i + 2;
      } else {
        currentLines.push(lines[i]);
      }
    }

    if (currentLines.length > 0) {
      const text = currentLines.join('\n');
      if (text.trim()) {
        docs.push({ text, startLine });
      }
    }

    return docs;
  }

  private isK8sManifest(doc: Record<string, unknown>): boolean {
    return typeof doc.kind === 'string' &&
      typeof doc.apiVersion === 'string';
  }

  private isHelmTemplate(content: string, filePath: string): boolean {
    if (filePath.includes('/templates/') || filePath.includes('/charts/')) {
      return true;
    }
    return HELM_INDICATORS.some(indicator => content.includes(indicator));
  }

  private stripHelmTemplating(content: string): string {
    return content
      .replace(/\{\{-?\s*.*?\s*-?\}\}/g, 'HELM_PLACEHOLDER')
      .replace(/\{\{-?\s*[\s\S]*?\s*-?\}\}/g, 'HELM_PLACEHOLDER');
  }

  private parseResource(
    doc: Record<string, unknown>,
    filePath: string,
    line: number,
  ): K8sResource | null {
    const kind = doc.kind as string;
    const apiVersion = doc.apiVersion as string;
    const metadata = doc.metadata as Record<string, unknown> | undefined;

    const name = (metadata?.name as string) || `unnamed-${kind.toLowerCase()}`;
    const namespace = metadata?.namespace as string | undefined;
    const labels = metadata?.labels as Record<string, string> | undefined;
    const annotations = metadata?.annotations as Record<string, string> | undefined;

    const references = this.extractReferences(doc, kind);

    return {
      apiVersion,
      kind,
      name,
      namespace,
      labels,
      annotations,
      filePath,
      line,
      references,
      raw: doc,
    };
  }

  private extractReferences(doc: Record<string, unknown>, kind: string): K8sReference[] {
    const refs: K8sReference[] = [];

    switch (kind) {
      case 'Deployment':
      case 'StatefulSet':
      case 'DaemonSet':
      case 'ReplicaSet':
      case 'Job':
      case 'CronJob':
        refs.push(...this.extractWorkloadRefs(doc));
        break;

      case 'Service':
        refs.push(...this.extractServiceRefs(doc));
        break;

      case 'Ingress':
        refs.push(...this.extractIngressRefs(doc));
        break;

      case 'Application':
        refs.push(...this.extractArgoAppRefs(doc));
        break;

      case 'ApplicationSet':
        refs.push(...this.extractArgoAppSetRefs(doc));
        break;

      case 'Workflow':
      case 'WorkflowTemplate':
      case 'CronWorkflow':
        refs.push(...this.extractArgoWorkflowRefs(doc));
        break;

      case 'Rollout':
        refs.push(...this.extractArgoRolloutRefs(doc));
        break;

      case 'HorizontalPodAutoscaler':
        refs.push(...this.extractHPARefs(doc));
        break;

      case 'RoleBinding':
      case 'ClusterRoleBinding':
        refs.push(...this.extractRoleBindingRefs(doc));
        break;

      case 'Sensor':
        refs.push(...this.extractArgoSensorRefs(doc));
        break;

      case 'PersistentVolumeClaim':
        refs.push(...this.extractPVCRefs(doc));
        break;

      case 'NetworkPolicy':
        refs.push(...this.extractNetworkPolicyRefs(doc));
        break;
    }

    refs.push(...this.extractVolumeRefs(doc));
    refs.push(...this.extractServiceAccountRef(doc));

    return refs;
  }

  private extractWorkloadRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const template = spec.template as Record<string, unknown> | undefined;
    const podSpec = (template?.spec || spec) as Record<string, unknown> | undefined;
    if (!podSpec) { return refs; }

    const containers = [
      ...(podSpec.containers as unknown[] || []),
      ...(podSpec.initContainers as unknown[] || []),
    ];

    for (const container of containers) {
      const c = container as Record<string, unknown>;

      const envFrom = c.envFrom as unknown[] | undefined;
      if (envFrom) {
        for (const ef of envFrom) {
          const entry = ef as Record<string, unknown>;
          const cmRef = entry.configMapRef as Record<string, unknown> | undefined;
          if (cmRef?.name) {
            refs.push({
              targetKind: 'ConfigMap',
              targetName: cmRef.name as string,
              relationship: 'configures',
              field: 'spec.template.spec.containers[].envFrom[].configMapRef',
            });
          }
          const secretRef = entry.secretRef as Record<string, unknown> | undefined;
          if (secretRef?.name) {
            refs.push({
              targetKind: 'Secret',
              targetName: secretRef.name as string,
              relationship: 'configures',
              field: 'spec.template.spec.containers[].envFrom[].secretRef',
            });
          }
        }
      }

      const env = c.env as unknown[] | undefined;
      if (env) {
        for (const e of env) {
          const envVar = e as Record<string, unknown>;
          const valueFrom = envVar.valueFrom as Record<string, unknown> | undefined;
          if (!valueFrom) { continue; }

          const cmKeyRef = valueFrom.configMapKeyRef as Record<string, unknown> | undefined;
          if (cmKeyRef?.name) {
            refs.push({
              targetKind: 'ConfigMap',
              targetName: cmKeyRef.name as string,
              relationship: 'configures',
              field: 'spec.template.spec.containers[].env[].valueFrom.configMapKeyRef',
            });
          }

          const secretKeyRef = valueFrom.secretKeyRef as Record<string, unknown> | undefined;
          if (secretKeyRef?.name) {
            refs.push({
              targetKind: 'Secret',
              targetName: secretKeyRef.name as string,
              relationship: 'configures',
              field: 'spec.template.spec.containers[].env[].valueFrom.secretKeyRef',
            });
          }
        }
      }

      const volumeMounts = c.volumeMounts as unknown[] | undefined;
      if (volumeMounts) {
        for (const vm of volumeMounts) {
          const mount = vm as Record<string, unknown>;
          if (mount.name) {
            refs.push({
              targetKind: 'Volume',
              targetName: mount.name as string,
              relationship: 'mounts',
              field: 'spec.template.spec.containers[].volumeMounts[]',
            });
          }
        }
      }
    }

    return refs;
  }

  private extractServiceRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const selector = spec.selector as Record<string, string> | undefined;
    if (selector) {
      const appLabel = selector.app || selector['app.kubernetes.io/name'];
      if (appLabel) {
        refs.push({
          targetKind: 'Deployment',
          targetName: appLabel,
          relationship: 'selects',
          field: 'spec.selector',
        });
      }
    }

    return refs;
  }

  private extractIngressRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const rules = spec.rules as unknown[] | undefined;
    if (rules) {
      for (const rule of rules) {
        const r = rule as Record<string, unknown>;
        const http = r.http as Record<string, unknown> | undefined;
        const paths = http?.paths as unknown[] | undefined;
        if (!paths) { continue; }
        for (const p of paths) {
          const pathEntry = p as Record<string, unknown>;
          const backend = pathEntry.backend as Record<string, unknown> | undefined;
          const service = backend?.service as Record<string, unknown> | undefined;
          const svcName = service?.name as string | undefined;
          if (svcName) {
            refs.push({
              targetKind: 'Service',
              targetName: svcName,
              relationship: 'exposes',
              field: 'spec.rules[].http.paths[].backend.service',
            });
          }
          // v1beta1 style
          const serviceName = backend?.serviceName as string | undefined;
          if (serviceName) {
            refs.push({
              targetKind: 'Service',
              targetName: serviceName,
              relationship: 'exposes',
              field: 'spec.rules[].http.paths[].backend.serviceName',
            });
          }
        }
      }
    }

    const defaultBackend = spec.defaultBackend as Record<string, unknown> | undefined;
    if (defaultBackend) {
      const svc = defaultBackend.service as Record<string, unknown> | undefined;
      if (svc?.name) {
        refs.push({
          targetKind: 'Service',
          targetName: svc.name as string,
          relationship: 'exposes',
          field: 'spec.defaultBackend.service',
        });
      }
    }

    return refs;
  }

  private extractArgoAppRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const destination = spec.destination as Record<string, unknown> | undefined;
    if (destination?.namespace) {
      refs.push({
        targetKind: 'Namespace',
        targetName: destination.namespace as string,
        relationship: 'targets',
        field: 'spec.destination.namespace',
      });
    }

    const project = spec.project as string | undefined;
    if (project) {
      refs.push({
        targetKind: 'AppProject',
        targetName: project,
        relationship: 'contains',
        field: 'spec.project',
      });
    }

    const extractSourceRefs = (source: Record<string, unknown>, prefix: string) => {
      if (source.chart) {
        refs.push({
          targetKind: 'HelmChart',
          targetName: source.chart as string,
          relationship: 'syncs',
          field: `${prefix}.chart`,
        });
      }

      if (source.path && !source.chart) {
        const pathName = source.path as string;
        refs.push({
          targetKind: 'HelmChart',
          targetName: pathName.split('/').pop() || pathName,
          relationship: 'syncs',
          field: `${prefix}.path`,
        });
      }

      const helm = source.helm as Record<string, unknown> | undefined;
      if (helm) {
        const valueFiles = helm.valueFiles as string[] | undefined;
        if (valueFiles) {
          for (const vf of valueFiles) {
            refs.push({
              targetKind: 'HelmValues',
              targetName: vf.split('/').pop() || vf,
              relationship: 'configures',
              field: `${prefix}.helm.valueFiles[]`,
            });
          }
        }
        const releaseName = helm.releaseName as string | undefined;
        if (releaseName) {
          refs.push({
            targetKind: 'HelmRelease',
            targetName: releaseName,
            relationship: 'deploys',
            field: `${prefix}.helm.releaseName`,
          });
        }
      }
    };

    const source = spec.source as Record<string, unknown> | undefined;
    if (source) {
      extractSourceRefs(source, 'spec.source');
    }

    const sources = spec.sources as unknown[] | undefined;
    if (sources) {
      for (const s of sources) {
        extractSourceRefs(s as Record<string, unknown>, 'spec.sources[]');
      }
    }

    return refs;
  }

  private extractArgoAppSetRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const template = spec.template as Record<string, unknown> | undefined;
    const templateSpec = template?.spec as Record<string, unknown> | undefined;

    if (templateSpec?.project) {
      refs.push({
        targetKind: 'AppProject',
        targetName: templateSpec.project as string,
        relationship: 'contains',
        field: 'spec.template.spec.project',
      });
    }

    if (templateSpec?.destination) {
      const dest = templateSpec.destination as Record<string, unknown>;
      if (dest.namespace) {
        refs.push({
          targetKind: 'Namespace',
          targetName: dest.namespace as string,
          relationship: 'targets',
          field: 'spec.template.spec.destination.namespace',
        });
      }
    }

    const extractTemplateSource = (source: Record<string, unknown>, prefix: string) => {
      if (source.chart) {
        refs.push({
          targetKind: 'HelmChart',
          targetName: source.chart as string,
          relationship: 'syncs',
          field: `${prefix}.chart`,
        });
      }
      if (source.path && !source.chart) {
        const pathName = source.path as string;
        refs.push({
          targetKind: 'HelmChart',
          targetName: pathName.split('/').pop() || pathName,
          relationship: 'syncs',
          field: `${prefix}.path`,
        });
      }
      const helm = source.helm as Record<string, unknown> | undefined;
      if (helm?.valueFiles) {
        for (const vf of helm.valueFiles as string[]) {
          refs.push({
            targetKind: 'HelmValues',
            targetName: vf.split('/').pop() || vf,
            relationship: 'configures',
            field: `${prefix}.helm.valueFiles[]`,
          });
        }
      }
    };

    const templateSource = templateSpec?.source as Record<string, unknown> | undefined;
    if (templateSource) {
      extractTemplateSource(templateSource, 'spec.template.spec.source');
    }

    const templateSources = templateSpec?.sources as unknown[] | undefined;
    if (templateSources) {
      for (const s of templateSources) {
        extractTemplateSource(s as Record<string, unknown>, 'spec.template.spec.sources[]');
      }
    }

    return refs;
  }

  private extractArgoWorkflowRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const templates = spec.templates as unknown[] | undefined;
    if (templates) {
      for (const t of templates) {
        const tmpl = t as Record<string, unknown>;
        const container = tmpl.container as Record<string, unknown> | undefined;
        if (container?.image) {
          refs.push({
            targetKind: 'ContainerImage',
            targetName: container.image as string,
            relationship: 'deploys',
            field: 'spec.templates[].container.image',
          });
        }

        const templateRef = tmpl.templateRef as Record<string, unknown> | undefined;
        if (templateRef?.name) {
          refs.push({
            targetKind: 'WorkflowTemplate',
            targetName: templateRef.name as string,
            relationship: 'references',
            field: 'spec.templates[].templateRef',
          });
        }
      }
    }

    const workflowTemplateRef = spec.workflowTemplateRef as Record<string, unknown> | undefined;
    if (workflowTemplateRef?.name) {
      refs.push({
        targetKind: 'WorkflowTemplate',
        targetName: workflowTemplateRef.name as string,
        relationship: 'references',
        field: 'spec.workflowTemplateRef',
      });
    }

    return refs;
  }

  private extractArgoRolloutRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const strategy = spec.strategy as Record<string, unknown> | undefined;
    if (!strategy) { return refs; }

    const canary = strategy.canary as Record<string, unknown> | undefined;
    if (canary) {
      const canaryService = canary.canaryService as string | undefined;
      if (canaryService) {
        refs.push({
          targetKind: 'Service',
          targetName: canaryService,
          relationship: 'targets',
          field: 'spec.strategy.canary.canaryService',
        });
      }
      const stableService = canary.stableService as string | undefined;
      if (stableService) {
        refs.push({
          targetKind: 'Service',
          targetName: stableService,
          relationship: 'targets',
          field: 'spec.strategy.canary.stableService',
        });
      }

      const analysis = canary.analysis as Record<string, unknown> | undefined;
      const analysisTemplates = analysis?.templates as unknown[] | undefined;
      if (analysisTemplates) {
        for (const at of analysisTemplates) {
          const tmpl = at as Record<string, unknown>;
          if (tmpl.templateName) {
            refs.push({
              targetKind: 'AnalysisTemplate',
              targetName: tmpl.templateName as string,
              relationship: 'triggers',
              field: 'spec.strategy.canary.analysis.templates[]',
            });
          }
        }
      }
    }

    return refs;
  }

  private extractHPARefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const scaleTargetRef = spec.scaleTargetRef as Record<string, unknown> | undefined;
    if (scaleTargetRef) {
      refs.push({
        targetKind: (scaleTargetRef.kind as string) || 'Deployment',
        targetName: (scaleTargetRef.name as string) || 'unknown',
        relationship: 'targets',
        field: 'spec.scaleTargetRef',
      });
    }

    return refs;
  }

  private extractRoleBindingRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];

    const roleRef = doc.roleRef as Record<string, unknown> | undefined;
    if (roleRef?.name) {
      refs.push({
        targetKind: (roleRef.kind as string) || 'Role',
        targetName: roleRef.name as string,
        relationship: 'references',
        field: 'roleRef',
      });
    }

    const subjects = doc.subjects as unknown[] | undefined;
    if (subjects) {
      for (const s of subjects) {
        const subj = s as Record<string, unknown>;
        if (subj.kind === 'ServiceAccount' && subj.name) {
          refs.push({
            targetKind: 'ServiceAccount',
            targetName: subj.name as string,
            relationship: 'references',
            field: 'subjects[]',
          });
        }
      }
    }

    return refs;
  }

  private extractArgoSensorRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const dependencies = spec.dependencies as unknown[] | undefined;
    if (dependencies) {
      for (const d of dependencies) {
        const dep = d as Record<string, unknown>;
        if (dep.eventSourceName) {
          refs.push({
            targetKind: 'EventSource',
            targetName: dep.eventSourceName as string,
            relationship: 'depends',
            field: 'spec.dependencies[].eventSourceName',
          });
        }
      }
    }

    const triggers = spec.triggers as unknown[] | undefined;
    if (triggers) {
      for (const t of triggers) {
        const trigger = t as Record<string, unknown>;
        const template = trigger.template as Record<string, unknown> | undefined;
        const argoWorkflow = template?.argoWorkflow as Record<string, unknown> | undefined;
        if (argoWorkflow) {
          const source = argoWorkflow.source as Record<string, unknown> | undefined;
          const resource = source?.resource as Record<string, unknown> | undefined;
          if (resource) {
            const metadata = resource.metadata as Record<string, unknown> | undefined;
            if (metadata?.generateName) {
              refs.push({
                targetKind: 'Workflow',
                targetName: metadata.generateName as string,
                relationship: 'triggers',
                field: 'spec.triggers[].template.argoWorkflow',
              });
            }
          }
        }
        const k8s = template?.k8s as Record<string, unknown> | undefined;
        if (k8s) {
          const source = k8s.source as Record<string, unknown> | undefined;
          const resource = source?.resource as Record<string, unknown> | undefined;
          if (resource?.kind) {
            refs.push({
              targetKind: resource.kind as string,
              targetName: (resource.metadata as Record<string, unknown>)?.name as string || 'unnamed',
              relationship: 'triggers',
              field: 'spec.triggers[].template.k8s',
            });
          }
        }
      }
    }

    return refs;
  }

  private extractPVCRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    if (spec.storageClassName) {
      refs.push({
        targetKind: 'StorageClass',
        targetName: spec.storageClassName as string,
        relationship: 'references',
        field: 'spec.storageClassName',
      });
    }

    if (spec.volumeName) {
      refs.push({
        targetKind: 'PersistentVolume',
        targetName: spec.volumeName as string,
        relationship: 'mounts',
        field: 'spec.volumeName',
      });
    }

    return refs;
  }

  private extractNetworkPolicyRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const podSelector = spec.podSelector as Record<string, unknown> | undefined;
    const matchLabels = podSelector?.matchLabels as Record<string, string> | undefined;
    if (matchLabels) {
      const appLabel = matchLabels.app || matchLabels['app.kubernetes.io/name'];
      if (appLabel) {
        refs.push({
          targetKind: 'Deployment',
          targetName: appLabel,
          relationship: 'selects',
          field: 'spec.podSelector',
        });
      }
    }

    return refs;
  }

  private extractVolumeRefs(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const template = spec.template as Record<string, unknown> | undefined;
    const podSpec = (template?.spec || spec) as Record<string, unknown> | undefined;
    if (!podSpec) { return refs; }

    const volumes = podSpec.volumes as unknown[] | undefined;
    if (!volumes) { return refs; }

    for (const v of volumes) {
      const vol = v as Record<string, unknown>;

      const cm = vol.configMap as Record<string, unknown> | undefined;
      if (cm?.name) {
        refs.push({
          targetKind: 'ConfigMap',
          targetName: cm.name as string,
          relationship: 'mounts',
          field: 'spec.template.spec.volumes[].configMap',
        });
      }

      const secret = vol.secret as Record<string, unknown> | undefined;
      if (secret?.secretName) {
        refs.push({
          targetKind: 'Secret',
          targetName: secret.secretName as string,
          relationship: 'mounts',
          field: 'spec.template.spec.volumes[].secret',
        });
      }

      const pvc = vol.persistentVolumeClaim as Record<string, unknown> | undefined;
      if (pvc?.claimName) {
        refs.push({
          targetKind: 'PersistentVolumeClaim',
          targetName: pvc.claimName as string,
          relationship: 'mounts',
          field: 'spec.template.spec.volumes[].persistentVolumeClaim',
        });
      }
    }

    return refs;
  }

  private extractServiceAccountRef(doc: Record<string, unknown>): K8sReference[] {
    const refs: K8sReference[] = [];
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) { return refs; }

    const template = spec.template as Record<string, unknown> | undefined;
    const podSpec = (template?.spec || spec) as Record<string, unknown> | undefined;

    const saName = podSpec?.serviceAccountName as string | undefined;
    if (saName) {
      refs.push({
        targetKind: 'ServiceAccount',
        targetName: saName,
        relationship: 'references',
        field: 'spec.template.spec.serviceAccountName',
      });
    }

    return refs;
  }

  private kindToNodeType(kind: string): NodeType {
    if (K8S_CORE_KINDS.has(kind)) { return 'k8sResource' as NodeType; }
    if (ARGO_KINDS.has(kind)) { return 'argoResource' as NodeType; }
    return 'k8sResource' as NodeType;
  }

  getResourceCategory(kind: string): string {
    if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod'].includes(kind)) {
      return 'Workloads';
    }
    if (['Service', 'Ingress', 'NetworkPolicy'].includes(kind)) {
      return 'Networking';
    }
    if (['ConfigMap', 'Secret'].includes(kind)) {
      return 'Configuration';
    }
    if (['PersistentVolume', 'PersistentVolumeClaim'].includes(kind)) {
      return 'Storage';
    }
    if (['ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding'].includes(kind)) {
      return 'RBAC';
    }
    if (['Namespace', 'LimitRange', 'ResourceQuota'].includes(kind)) {
      return 'Cluster';
    }
    if (['HorizontalPodAutoscaler', 'PodDisruptionBudget'].includes(kind)) {
      return 'Scaling';
    }
    if (['Application', 'ApplicationSet', 'AppProject'].includes(kind)) {
      return 'Argo CD';
    }
    if (['Workflow', 'WorkflowTemplate', 'CronWorkflow', 'ClusterWorkflowTemplate'].includes(kind)) {
      return 'Argo Workflows';
    }
    if (['Rollout', 'AnalysisTemplate', 'AnalysisRun', 'Experiment'].includes(kind)) {
      return 'Argo Rollouts';
    }
    if (['EventSource', 'Sensor', 'EventBus'].includes(kind)) {
      return 'Argo Events';
    }
    return 'Custom Resources';
  }
}
