import { LIVE_ROUTE as DEFAULT_LIVE_ROUTE } from './ntuLiveRoute'
import { createCampusActors } from './ntuLiveEpisodeActors'
export async function createEpisode(
  THREE,
  {
    scene,
    camera,
    controls,
    campus,
    root,
    language,
    onFinish,
    route: LIVE_ROUTE = DEFAULT_LIVE_ROUTE,
    getGroundHeight,
    getCamera
  }
) {
  let lang = language
  let running = false
  let paused = false
  let ended = false
  let stage = 0
  let elapsed = 0
  let wait = 0
  let walking = false
  let distance = 0
  let abort
  let trace = []
  let memory
  let caption = ''
  let speaker = ''
  let channel = ''
  let observed = ''
  let action = ''
  let retryWalk
  const zh = () => lang === 'zh'
  const tr = (en, cn) => (zh() ? cn : en)
  const ray = new THREE.Raycaster()
  const colliders = campus.colliders ?? campus.collisionMeshes ?? []
  const ground = p => {
    const supplied = getGroundHeight?.(p)
    if (Number.isFinite(supplied)) return supplied
    ray.set(new THREE.Vector3(p.x, p.y + 2, p.z), new THREE.Vector3(0, -1, 0))
    ray.far = 15
    const near = colliders.filter(m => {
      const b = m.geometry?.boundingBox
      return (
        b &&
        p.x >= b.min.x &&
        p.x <= b.max.x &&
        p.z >= b.min.z &&
        p.z <= b.max.z &&
        b.min.y < p.y + 2 &&
        b.max.y > p.y - 13
      )
    })
    const hit = ray
      .intersectObjects(near, false)
      .find(h => Math.abs(h.face?.normal.y ?? 0) > 0.65)
    return hit?.point.y ?? p.y
  }
  const point = p => ({ ...p, y: ground(p) })
  const actors = createCampusActors(THREE, {
    scene,
    getGroundHeight: ground,
    route: LIVE_ROUTE
  })
  const setText = (who, en, cn) => {
    speaker = who
    caption = tr(en, cn)
    render()
  }
  function record(code, en, cn, changes = {}) {
    channel = code
    Object.assign(memory, changes)
    trace.push({
      time: Number(elapsed.toFixed(1)),
      channel: code,
      event: { en, zh: cn },
      changes,
      position: controls.getState().position,
      distance: Number(distance.toFixed(1))
    })
    render()
  }
  const look = p => controls.lookAt?.({ x: p.x, y: ground(p) + 1.55, z: p.z })
  function walk(from, to, next) {
    walking = true
    action = tr('Walking to the next interaction.', '正在走向下一个交互点。')
    render()
    const path = LIVE_ROUTE.path.slice(from, to + 1).map(point)
    controls.autoWalk(
      path,
      result => {
        if (!running || abort?.signal.aborted) return
        walking = false
        distance += result.distance ?? 0
        if (!result.ok) {
          caption = tr(
            'The walking route was blocked. Playback stopped; the blocked step was not marked complete.',
            '行走路线受阻，演示已停止；未把受阻步骤记为完成。'
          )
          speaker = 'HALO'
          action = result.reason
          paused = true
          controls.setPaused(true)
          const current = controls.getState().position
          let nearest = from
          for (let i = from; i <= to; i++) {
            if (
              Math.hypot(
                LIVE_ROUTE.path[i].x - current.x,
                LIVE_ROUTE.path[i].z - current.z
              ) <
                Math.hypot(
                  LIVE_ROUTE.path[nearest].x - current.x,
                  LIVE_ROUTE.path[nearest].z - current.z
                )
            ) { nearest = i }
          }
          retryWalk = () => walk(nearest, to, next)
          render()
          return
        }
        stage = next
        wait = 0
      },
      abort.signal,
      { speed: 1.8 }
    )
  }
  function render() {
    if (!running && !ended) {
      root.hidden = true
      return
    }
    root.hidden = false
    if (ended) {
      root.innerHTML = ''
      const panel = document.createElement('div')
      panel.className = 'episode-glass episode-report'
      const h = document.createElement('h2')
      h.textContent = tr(
        'A short walk. A complete loop.',
        '一段连续行走，一次完整闭环。'
      )
      const p = document.createElement('p')
      p.textContent = tr(
        `${distance.toFixed(1)} m walked · ${
          trace.length
        } recorded events · ${Math.round(elapsed)} s`,
        `实际行走 ${distance.toFixed(1)} 米 · ${
          trace.length
        } 条记录 · ${Math.round(elapsed)} 秒`
      )
      const ol = document.createElement('ol')
      for (const e of trace) {
        const li = document.createElement('li')
        li.textContent = `${e.time}s · ${e.channel} — ${e.event[lang]}`
        ol.append(li)
      }
      const small = document.createElement('small')
      small.textContent = tr(
        'Fictional colleagues and an authored task near ABN. The geometry references NTUMap. Observations are scripted events, not camera or microphone inference. A memory update is not a learned policy.',
        'ABN 附近的虚构同事与任务，几何参考 NTUMap。观察来自脚本事件，不是摄像头或麦克风推理；记忆更新不等于策略学习。'
      )
      const close = document.createElement('button')
      close.textContent = tr('Explore from here', '从这里继续探索')
      close.onclick = stop
      const download = document.createElement('button')
      download.textContent = tr('Download trajectory', '下载 trajectory')
      download.onclick = () => {
        const u = URL.createObjectURL(
          new Blob(
            [
              JSON.stringify(
                {
                  version: 2,
                  kind: 'scripted-world-episode',
                  distance,
                  elapsed,
                  memory,
                  trace
                },
                null,
                2
              )
            ],
            { type: 'application/json' }
          )
        )
        const a = document.createElement('a')
        a.href = u
        a.download = 'ntu-live-episode.json'
        a.click()
        setTimeout(() => URL.revokeObjectURL(u), 1000)
      }
      panel.append(
        h,
        p,
        ol,
        small,
        document.createElement('hr'),
        close,
        download
      )
      root.append(panel)
      return
    }
    root.innerHTML =
      '<div class="episode-glass episode-ledger"><h3></h3><p><b class="s">S / SENSING</b><span data-ledger="s"></span></p><p><b class="m">M / MEMORY</b><span data-ledger="m"></span></p><p><b class="a">A / ACTION</b><span data-ledger="a"></span></p><small class="loop"></small></div><div class="episode-glass episode-caption"><strong></strong><span></span></div><div class="episode-bar glass"><button data-pause></button><button data-stop></button><span style="padding:8px;font-size:10px" data-progress></span></div>'
    root.querySelector('h3').textContent = tr(
      'S-Lab · continuous episode',
      'S-Lab · 连续经历'
    )
    root.querySelector('[data-ledger=s]').textContent = observed
    root.querySelector('[data-ledger=m]').textContent = Object.values(
      memory ?? {}
    ).join(' · ')
    root.querySelector('[data-ledger=a]').textContent = action
    root.querySelector('.loop').textContent = `${channel} · ${tr(
      'SCRIPTED',
      '预设事件'
    )}`
    root.querySelector('.episode-caption strong').textContent = speaker
    root.querySelector('.episode-caption span').textContent = caption
    root.querySelector('[data-pause]').textContent = retryWalk
      ? tr('Retry walk', '重试行走')
      : paused
        ? tr('Continue', '继续')
        : tr('Pause', '暂停')
    root.querySelector('[data-pause]').onclick = () => setPaused(!paused)
    root.querySelector('[data-stop]').textContent = tr(
      'End episode',
      '结束演示'
    )
    root.querySelector('[data-stop]').onclick = stop
    root.querySelector('[data-progress]').textContent = `${(
      distance + (walking ? controls.getState().distance : 0)
    ).toFixed(1)} m`
  }
  function stop() {
    retryWalk = undefined
    walking = false
    abort?.abort()
    controls.stop()
    running = false
    ended = false
    actors.hide()
    root.hidden = true
    document.body.classList.remove('episode-running')
    controls.setPaused(false)
    onFinish?.()
  }
  function start() {
    stop()
    abort = new AbortController()
    running = true
    ended = false
    paused = false
    stage = 0
    wait = 0
    elapsed = 0
    distance = 0
    trace = []
    memory = {
      prior: tr(
        'S-Lab equipment errand; authorized pickup, no small-talk retention.',
        'S-Lab 设备对接；授权代领，不保留闲聊。'
      )
    }
    controls.setMode('walk')
    controls.setPosition(point(LIVE_ROUTE.start), {
      ...LIVE_ROUTE.colleague,
      y: ground(LIVE_ROUTE.colleague) + 1.5
    })
    actors.show()
    actors.setParcel('desk')
    document.body.classList.add('episode-running')
    observed = tr(
      'A colleague is waiting beside ABN.',
      'ABN 附近有一位正在等候的同事。'
    )
    action = tr('Approach and confirm the task.', '走近并确认任务。')
    channel = 'M → S'
    setText(
      'HALO',
      'Your standing permission focuses attention on the S-Lab pickup. Walk over and confirm the current request.',
      '已有授权让助手关注 S-Lab 的领取安排。先走到同事面前，确认当前任务。'
    )
  }
  function setPaused(value) {
    paused = value
    controls.setPaused(value)
    if (!value && retryWalk) {
      const retry = retryWalk
      retryWalk = undefined
      caption = tr(
        'Resuming the walking route from the current position.',
        '从当前位置重新尝试这段行走路线。'
      )
      retry()
    }
    render()
  }
  function update(dt) {
    if (paused || document.hidden) return
    const activeCamera = getCamera?.() ?? camera
    actors.update(dt, activeCamera.position, activeCamera.quaternion)
    if (!running) return
    elapsed += dt
    if (walking) {
      const meter = root.querySelector('[data-progress]')
      if (meter) {
        meter.textContent = `${(
          distance + controls.getState().distance
        ).toFixed(1)} m`
      }
      return
    }
    wait += dt
    switch (stage) {
      case 0:
        if (wait > 3) {
          record(
            'M → S',
            'The prior directs attention to the colleague.',
            '已有记忆把注意力引向同事。'
          )
          stage = -1
          walk(0, 6, 1)
        }
        break
      case 1:
        look(LIVE_ROUTE.colleague)
        actors.gesture('colleague', 'wave')
        observed = tr(
          'Colleague raises a hand and addresses you.',
          '同事抬手招呼，并向你说明任务。'
        )
        setText(
          tr('Colleague', '同事'),
          'Could you collect the A17 glasses kit from the desk? Please check the label before collecting it.',
          '能帮我去前面的桌子领 A17 眼镜套件吗？领取前，记得先核对标签。'
        )
        stage = 2
        wait = 0
        break
      case 2:
        if (wait > 5) {
          actors.gesture('colleague', 'talk')
          record(
            'S → M',
            'The spoken request becomes a scoped pending commitment.',
            '把刚听到的要求写成有范围的待办承诺。',
            {
              task: tr(
                'A17 pickup pending · this visit only',
                'A17 待领取 · 仅本次访问'
              )
            }
          )
          setText(
            'HALO',
            'I retained the kit identifier and today’s task. I did not retain unrelated conversation.',
            '已记住套件编号和本次任务，不保留无关闲聊。'
          )
          stage = 3
          wait = 0
        }
        break
      case 3:
        if (wait > 3) {
          record(
            'M → A',
            'The pending commitment prompts a walk to the handoff desk.',
            '待办记忆促成前往交接桌的行动。'
          )
          setText(
            'HALO',
            'The desk is ahead. I’ll keep A17 in context while you walk.',
            '交接桌就在前面。行走过程中，A17 的任务上下文会持续保留。'
          )
          stage = -1
          walk(6, 20, 4)
        }
        break
      case 4:
        look(LIVE_ROUTE.steward)
        actors.gesture('steward', 'wave')
        observed = tr(
          'A steward and a labeled parcel are in front of you.',
          '面前是交接同学和有标签的物品。'
        )
        action = tr(
          'Ask for a label check before accepting.',
          '接收前先核对标签。'
        )
        record(
          'A → S',
          'The pickup action requests fresh evidence of the A17 label.',
          '领取行动发起一次新的标签核对。'
        )
        setText(
          tr('You', '你'),
          'Hi, I’m collecting A17 for S-Lab. Could we check the label together?',
          '你好，我来代领 S-Lab 的 A17。我们一起核对一下标签？'
        )
        stage = 5
        wait = 0
        break
      case 5:
        if (wait > 4) {
          controls.lookAt?.({
            ...LIVE_ROUTE.pickup,
            y: ground(LIVE_ROUTE.pickup) + 0.9
          })
          actors.gesture('steward', 'handoff')
          observed = tr(
            'The steward presents the A17 parcel.',
            '交接同学展示 A17 物品。'
          )
          setText(
            tr('Steward', '交接同学'),
            'This is A17. Here you are. Please bring it back to your colleague.',
            '这是 A17，给你。麻烦带回给你的同事。'
          )
          stage = 6
          wait = 0
        }
        break
      case 6:
        if (wait > 3) {
          actors.gesture('steward', 'handoff')
          actors.setParcel('carried')
          stage = 61
          wait = 0
        }
        break
      case 61:
        if (wait > 1 && !actors.isTransferring?.()) {
          record(
            'A → M',
            'The visible handoff creates a simulated pickup receipt.',
            '可见的物品交接产生模拟领取凭证。',
            {
              task: tr(
                'A17 collected; delivery pending',
                'A17 已领取；待交给同事'
              )
            }
          )
          action = tr(
            'Carry the kit back to the colleague.',
            '携带套件回到同事身边。'
          )
          setText(
            'HALO',
            'Pickup confirmed in this simulation. The task remains open until the kit reaches your colleague.',
            '模拟领取已确认。物品交到同事手里之前，任务仍未完成。'
          )
          stage = 7
          wait = 0
        }
        break
      case 7:
        if (wait > 3) {
          stage = -1
          walk(20, 34, 8)
        }
        break
      case 8:
        look(LIVE_ROUTE.colleague)
        actors.gesture('colleague', 'handoff')
        setText(
          tr('Colleague', '同事'),
          'Thank you — that’s the kit we need. I’ve received it.',
          '谢谢，就是这套设备。我收到了。'
        )
        observed = tr(
          'The colleague reaches out for the kit.',
          '同事伸手接过套件。'
        )
        stage = 9
        wait = 0
        break
      case 9:
        if (wait > 3) {
          actors.gesture('colleague', 'handoff')
          actors.setParcel('delivered')
          stage = 91
          wait = 0
        }
        break
      case 91:
        if (wait > 1 && !actors.isTransferring?.()) {
          record(
            'A → M',
            'Handoff closes the original commitment; no policy change is claimed.',
            '交付闭合原始承诺，不表示策略发生学习更新。',
            {
              task: tr(
                'A17 delivered · commitment completed',
                'A17 已交付 · 承诺完成'
              )
            }
          )
          action = tr(
            'The commitment is complete; remain available.',
            '承诺已完成，继续保持可用。'
          )
          setText(
            'HALO',
            'The delivery receipt closes this task. I can stay present without continuing to interrupt.',
            '交付凭证让本次任务闭合。助手仍然在线，但不需要继续打断。'
          )
          stage = 10
          wait = 0
        }
        break
      case 10:
        if (wait > 3) {
          stage = -1
          walk(34, 40, 11)
        }
        break
      case 11:
        controls.stop()
        running = false
        ended = true
        render()
        break
    }
  }
  return {
    start,
    stop,
    update,
    setPaused,
    setLanguage(value) {
      lang = value
      render()
    },
    get running() {
      return running || ended
    },
    dispose() {
      stop()
      actors.dispose()
    }
  }
}
