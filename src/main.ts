import * as k8s from '@kubernetes/client-node'
import { V1Pod, V1Service } from '@kubernetes/client-node'
import { Core_v1Api } from './util'

const kc = new k8s.KubeConfig(); kc.loadFromDefault()
const k8sApi = kc.makeApiClient(Core_v1Api)

const watch = new k8s.Watch(kc)
const svcCache = new k8s.ListWatch('/api/v1/services', watch, f => f([]))
const podCache = new k8s.ListWatch('/api/v1/pods', watch, f => f([]))

const serviceModeAnnotation = 'qoqo.dev/service-mode'
const podDesignationLabel = 'qoqo.dev/pod-designation'

const loop = async () => {
    svcCache.list()
        .map(svc => svc as V1Service)
        .filter(svc => (svc.metadata.annotations || {})[serviceModeAnnotation])
        .forEach(async svc => {
            const ns = svc.metadata.namespace

            // get our service's selectors both with and without our custom pod designation label
            const selectors = svc.spec.selector
            const { [podDesignationLabel]: _, ...ogSelectors } = selectors

            // look at the eligible pods in our service's namespace
            const eligiblePods = podCache.list(ns)
                .map(pod => pod as V1Pod)
                .filter(pod => pod.status.phase === 'Running' && pod.status.containerStatuses.every(status => status.ready))
                .filter(pod => {
                    const labels = pod.metadata.labels || {}
                    return Object.keys(ogSelectors).every(k => ogSelectors[k] === labels[k])
                })

            // if there isn't an active pod out there, promote the first one
            if (!eligiblePods.some(pod => pod.metadata.labels[podDesignationLabel] === 'active') && eligiblePods.length > 0) {
                const activePodName = eligiblePods[0].metadata.name
                const res = await k8sApi.patchNamespacedPod(
                    activePodName,
                    ns,
                    { metadata: { labels: { [podDesignationLabel]: 'active' } } },
                ).catch(err => {
                    console.info(`[${ns}] Failed to designate pod ${activePodName} as active for service ${svc.metadata.name}: ${err.body.code}`)
                })
                if (res) {
                    console.info(`[${ns}] Designated pod ${activePodName} as active for service ${svc.metadata.name}`)
                }
            }

            // add the pod designation label as a selector to our service if it doesn't exist so it can select our active pod
            if (selectors[podDesignationLabel] !== 'active') {
                const res = await k8sApi.patchNamespacedService(
                    svc.metadata.name,
                    svc.metadata.namespace,
                    { spec: { selector: { [podDesignationLabel]: 'active' } } },
                ).catch(err => {
                    console.info(`[${ns}] Failed to augment service ${svc.metadata.name} with ${podDesignationLabel}=active selector: ${err.body.code}`)
                })
                if (res) {
                    console.info(`[${ns}] Augmented active-standby service ${svc.metadata.name} with ${podDesignationLabel}=active selector`)
                }
            }
        })
    setTimeout(loop, 1000)
}

console.info(`Targeting API server at ${k8sApi.basePath}`)
console.info(`Starting active-standby service controller...`)
loop()
