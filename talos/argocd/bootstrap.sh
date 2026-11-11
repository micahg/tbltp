#!/usr/bin/env bash
# One-time (per cluster) install of Argo CD, then hand everything else to GitOps.
# Uses the current kubectl context - check it first: kubectl config current-context
set -euo pipefail
cd "$(dirname "$0")"
CHART_VERSION=10.18.0

helm repo add argo https://argoproj.github.io/argo-helm >/dev/null
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd --version "$CHART_VERSION" \
  --namespace argocd --create-namespace -f values.yaml --wait --timeout 10m
kubectl apply -f root.yaml
echo "Argo CD installed. Initial admin password:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
