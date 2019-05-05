import {  Core_v1Api as Core_v1Api_Headerless, V1Pod, V1Service } from '@kubernetes/client-node'
import http from 'http'

// See the following issues for the purpose of this wrapper:
// - https://github.com/kubernetes/kubernetes/issues/61103
// - https://github.com/kubernetes-client/javascript/issues/19
//
// TLDR - we have to patch each individual PATCH method with the proper Content-Type K8s expects.
// And if we just set the default Content-Type in the constructor, it'll break non-PATCH methods.

const patch = (api: Core_v1Api, f: any, ...args: any[]) => {
    /* tslint:disable:no-string-literal */
    api['defaultHeaders'] = { 'Content-Type': 'application/merge-patch+json' }
    const patched = f.apply(api, args)
    api['defaultHeaders'] = {}
    return patched
}

export class Core_v1Api extends Core_v1Api_Headerless {
    public patchNamespacedPod(...args: any[]): Promise<{ response: http.IncomingMessage, body: V1Pod }> {
        return patch(this, super.patchNamespacedPod, ...args)
    }
    public patchNamespacedService(...args: any[]): Promise<{ response: http.IncomingMessage, body: V1Service }> {
        return patch(this, super.patchNamespacedService, ...args)
    }
}

console.info = (msg: any) => console.log(`[${new Date().toISOString()}] ${msg}`)
