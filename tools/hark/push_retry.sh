# 用法：echo <commit> > /tmp/commits; bash push_retry.sh  —— blobless 克隆推送时报缺 blob 就按需 fetch 再推
cd "${REPO:-repo}"
export GIT_NO_LAZY_FETCH=1
for c in $(cat /tmp/commits); do
  for t in $(seq 1 25); do
    out=$(timeout 300 git push origin $c:refs/heads/fix/character-performance 2>&1)
    if git ls-remote origin refs/heads/fix/character-performance | grep -q $c; then echo "pushed $c"; break; fi
    m=$(echo "$out" | grep -o 'could not fetch [0-9a-f]*' | awk '{print $4}')
    if [ -n "$m" ]; then git -c fetch.negotiationAlgorithm=noop fetch -q --filter=blob:none origin $m 2>&1 | tail -1; echo "fetched $m"; else echo "try $t: $(echo "$out"|tail -1)"; sleep 5; fi
  done
done
