#!/usr/bin/env bash
set -euo pipefail

runner_home=/opt/actions-runner
runner_state=/runner-state

install -d -o runner -g runner "${runner_state}" "${runner_home}/_work"

for state_file in .runner .credentials .credentials_rsaparams; do
  if [[ -f "${runner_state}/${state_file}" ]]; then
    install -o runner -g runner -m 600 \
      "${runner_state}/${state_file}" "${runner_home}/${state_file}"
  fi
done

if [[ ! -f "${runner_home}/.runner" ]]; then
  : "${GITHUB_REPOSITORY_URL:?Set GITHUB_REPOSITORY_URL for initial registration}"
  : "${RUNNER_REGISTRATION_TOKEN:?Set RUNNER_REGISTRATION_TOKEN for initial registration}"

  runuser -u runner -- "${runner_home}/config.sh" \
    --unattended \
    --disableupdate \
    --replace \
    --url "${GITHUB_REPOSITORY_URL}" \
    --token "${RUNNER_REGISTRATION_TOKEN}" \
    --name "${RUNNER_NAME:-bookkeeping-deploy}" \
    --work "_work"

  for state_file in .runner .credentials .credentials_rsaparams; do
    if [[ -f "${runner_home}/${state_file}" ]]; then
      install -o runner -g runner -m 600 \
        "${runner_home}/${state_file}" "${runner_state}/${state_file}"
    fi
  done
fi

unset RUNNER_REGISTRATION_TOKEN
exec runuser -u runner -- "${runner_home}/run.sh"
