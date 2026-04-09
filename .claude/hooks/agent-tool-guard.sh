#!/bin/bash
# 각 에이전트가 허용된 도구만 사용하도록 가드
# PreToolUse hook — 전체 에이전트 대상

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null)

# 에이전트가 아닌 메인 세션이면 통과
if [ -z "$AGENT_TYPE" ]; then
  exit 0
fi

# 에이전트별 허용 도구 맵 (현재 14개 에이전트)
case "$AGENT_TYPE" in
  planner)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash"
    ;;
  prd-generator)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash"
    ;;
  prd-validator)
    ALLOWED="Read|Glob|Grep|Bash"
    ;;
  architect)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash"
    ;;
  create-tasks)
    ALLOWED="Read|Glob|Grep|TaskCreate|TaskUpdate|TaskList|TaskGet"
    ;;
  frontend)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|TaskUpdate"
    ;;
  backend)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|TaskUpdate"
    ;;
  app-developer)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|TaskUpdate"
    ;;
  devops)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|TaskUpdate"
    ;;
  code-reviewer)
    ALLOWED="Read|Glob|Grep|Bash"
    ;;
  qa)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|TaskUpdate"
    ;;
  doc-writer)
    ALLOWED="Read|Write|Edit|Glob|Grep"
    ;;
  pm)
    ALLOWED="Read|Write|Edit|Glob|Grep|Bash|Agent|TaskCreate|TaskUpdate|TaskList|TaskGet"
    ;;
  git-manager)
    ALLOWED="Read|Glob|Grep|Bash"
    ;;
  *)
    # 알 수 없는 에이전트는 차단
    echo "{\"decision\":\"block\",\"reason\":\"[GUARD] 미등록 에이전트: $AGENT_TYPE\"}"
    exit 0
    ;;
esac

# 허용 목록 체크
if echo "$TOOL_NAME" | grep -qE "^($ALLOWED)$"; then
  exit 0
else
  echo "{\"decision\":\"block\",\"reason\":\"[GUARD] $AGENT_TYPE 에이전트에 허용되지 않은 도구: $TOOL_NAME\"}"
  exit 0
fi
