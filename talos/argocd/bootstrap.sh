#!/usr/bin/env bash
# One-time (per cluster) install of Argo CD, then hand everything else to GitOps.
# Usage: ./bootstrap.sh <dev|prod>
# Uses the current kubectl context - check it first: kubectl config current-context
set -euo pipefail
cd "$(dirname "$0")"
ENV="${1:?usage: $0 <dev|prod>}"
[ -f "$ENV/root.yaml" ] || { echo "no $ENV/root.yaml - unknown environment '$ENV'" >&2; exit 1; }
CHART_VERSION=10.18.0

echo "Installing Argo CD for '$ENV' into context: $(kubectl config current-context)"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd --version "$CHART_VERSION" \
  --namespace argocd --create-namespace -f values.yaml --wait --timeout 10m
kubectl apply -f "$ENV/root.yaml"
echo "Argo CD installed. Initial admin password:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
