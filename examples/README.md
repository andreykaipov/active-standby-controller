## Examples

This directory contains two examples for how active-standby services can be used.
The first shows off the new routing capabilities of our annotated services, while
the second shows off how pods can do master discovery through DNS resolution.

## Routing

Let's apply the `routing` example and start a proxy to the API:
```bash
$ kubectl apply -f routing.yaml
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

## Master Discovery

Now let's apply the `master-discovery` example and start a proxy to the API if necessary:
```bash
$ kubectl apply -f master-discovery.yaml
$ kubectl proxy &
```

This time we deploy three pods running dummy HTTP servers echoing out the elected master's IP in a
response header. The pods discover the master by resolving the headless service's name through DNS.
While discovery would usually be built into an application, this example uses a sidecar container.
It'll continuously ping the master to check if it's up, and if it fails to respond, the sidecar
will try to discover a new master.

We can use the normal non-headless service in front of our three pods to find out who the master is.
Let's query it fifty times to show off that every pod knows who the master is:
```bash
$ normal_svc="http://localhost:8001/api/v1/namespaces/default/services/echo-master:8080/proxy"
$ for i in $(seq 1 50); do curl -sLi $normal_svc | grep Master; done | sort | uniq -c
     50 Master: 10.52.1.11
```

We can also confirm it from our side by looking at the endpoints for the two services:
```bash
$ kubectl get endpoints | grep echo-master
echo-master             10.52.0.214:8080,10.52.1.11:8080,10.52.2.42:8080     11m
echo-master-discovery   10.52.1.11                                           11m
```
