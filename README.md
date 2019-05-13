## What is this?

This is a small Kubernetes controller extending services to support active-standby applications.

[![Docker Repository on Quay](https://quay.io/repository/qoqodev/active-standby-controller/status "Docker Repository on Quay")](https://quay.io/repository/qoqodev/active-standby-controller)

## How does it work?

Add `qoqo.dev/service-mode: active-standby` as an annotation to a Kubernetes service, and this
controller will automatically elect one of its selected pods as the master. Any requests sent to the
annotated service will then only be sent to the master pod.

In addition, the above annotation can be added to a headless service to do DNS-based master discovery.

To see examples of the above, see the [examples](./examples) directory.

## How do I use it?

The controller can be installed into the `kube-system` namespace of our cluster by applying the
`install.yaml` manifest in the root of this repo:

```bash
$ kubectl apply -f https://raw.githubusercontent.com/andreykaipov/active-standby-controller/master/install.yaml
```

It installs both the controller and the necessary RBAC resources the controller needs to function properly.

Alternatively, we can start the controller locally through a Docker container by giving it a kubeconfig
whose user in the current-context has permissions to both watch and patch pods and services across the cluster:

```bash
$ docker run --rm -v $HOME/.kube:/kube -e KUBECONFIG=/kube/config quay.io/qoqodev/active-standby-controller:slim
```

Note if the provided kubeconfig is targeting a cluster running on our local machine, Docker must be
ran with the `--network=host` flag.

## What's the motivation?

For whatever reason, suppose we have an application that can be scaled out, but requires only one
of its replicas to process or serve traffic at a time. Maybe it's stateful, or maybe it's meant to
delegate tasks to its replicas - who knows? In any case, this sort of application architecture is
not currently supported in Kubernetes. However, how might we introduce it?

The Kubernetes documentation on services mentions in its
[future work section](https://kubernetes.io/docs/concepts/services-networking/#future-work)
the following:

> In the future we envision that the proxy policy [for services] can become more nuanced than
  simple round robin balancing, for example master-elected or sharded. 

This controller brings master-elected functionality to Kubernetes services now. Hopefully it won't
be necessary once built-in support is provided, but until then, this controller will have to do.

The issue to track support for active-standby applications is
[kubernetes#45300](https://github.com/kubernetes/kubernetes/issues/45300).
Other approaches mentioned in the issue involve maintaining readiness probes to
periodically check who the elected master is. While these approaches work, pods were restricted
to StatefulSets, and failover tended to be too slow, so these solutions weren't ideal.

## TypeScript?

If you squint really hard you can pretend it's written in Go. 😉
