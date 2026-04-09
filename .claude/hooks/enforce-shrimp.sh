#!/bin/bash
# verify 에이전트가 shrimp-task-manager 외의 MCP를 사용하지 못하도록 차단
# PreToolUse hook — verify 에이전트 전용

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# verify 에이전트가 아니면 통과
if [ "$AGENT_TYPE" != "verify" ]; then
  exit 0
fi

# MCP 호출인 경우 shrimp-task-manager만 허용
if [[ "$TOOL_NAME" == mcp__* ]]; then
  if [[ "$TOOL_NAME" == mcp__shrimp-task-manager__* ]]; then
    exit 0
  else
    echo "verify 에이전트는 shrimp-task-manager MCP만 사용 가능합니다. (차단: $TOOL_NAME)" >&2
    exit 2
  fi
fi

# 허용된 기본 도구
case "$TOOL_NAME" in
  Read|Glob|Grep|Bash|TaskUpdate|TaskList|TaskGet)
    exit 0
    ;;
  *)
    echo "verify 에이전트에서 허용되지 않은 도구: $TOOL_NAME" >&2
    exit 2
    ;;
esac
