## What is this?

This is a small Kubernetes controller extending services to support active-standby applications.

[![Docker Repository on Quay](https://quay.io/repository/qoqodev/active-standby-controller/status "Docker Repository on Quay")](https://quay.io/repository/qoqodev/active-standby-controller)

## Why is it necessary?

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
to StatefulSets failed tended to be too slow, so these solutions weren't ideal.

## How does it work?

1. The controller listens for services with the annotation `qoqo.dev/service-mode: active-standby`.
1. When found, it'll look at the pods the service selects, and check to see if there's an active pod.
1. If there isn't one, promote the first pod by labeling it with `qoqo.dev/pod-designation: active`.
1. Now augment the annotated service's selectors with the same label so it only selects the active pod.

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
$ docker run --rm -v $HOME/.kube:/kube -e KUBECONFIG=/kube/config \
  quay.io/qoqodev/active-standby-controller:slim
```

Note if the provided kubeconfig is targeting a cluster running on our local machine, Docker must be
ran with the `--network=host` flag.

## Does it really work?

I'd like to think so! Let's apply the `active-standby` example and start a proxy to the API:
```bash
$ kubectl apply -f examples/active-standby.yaml
$ kubectl proxy &
```

This will deploy two pods that run dummy HTTP servers echoing their own hostname in a response header.
We'll be querying the following two services:
```bash
$ normal_svc="http://localhost:8001/api/v1/namespaces/default/services/echo-hostname:8080/proxy"
$ master_svc="http://localhost:8001/api/v1/namespaces/default/services/echo-hostname-master:8080/proxy"
```

The `normal_svc` load-balances between both pods, so if we were to query it fifty times,
we'll see an even distribution:
```bash
$ for i in $(seq 1 50); do curl -sLi $normal_svc | grep Hostname; done | sort | uniq -c
     24 Hostname: echo-hostname-56674448b4-c6qm9
     26 Hostname: echo-hostname-56674448b4-sk64m
```

However, if we query the master service, we'll find traffic only went to one pod:
```bash
$ for i in $(seq 1 50); do curl -sLi $master_svc | grep Hostname; done | uniq -c
     50 Hostname: echo-hostname-56674448b4-sk64m
```

Now if we delete the current master, we'll find traffic has instantly switched:
```bash
$ kubectl delete pod echo-hostname-56674448b4-sk64m &
$ for i in $(seq 1 50); do curl -sLi $master_svc | grep Hostname; done | uniq -c
     50 Hostname: echo-hostname-56674448b4-c6qm9
```

Depending on the speed of the proxy and whether or not the controller is running in-cluster, results
may vary. This was tested using a local cluster, but I've found failover takes around a second for
remote clusters.

## TypeScript?

If we squint really hard we can pretend it's written in Go. 😉
