(() => {
  "use strict";

  const STORAGE_KEY = "yingxin-demo-v1";
  const today = new Date();
  const dateKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  const initialState = {
    date: dateKey,
    mood: "calm",
    selectedMood: "calm",
    calm: 72,
    connection: 45,
    energy: 58,
    stress: 32,
    expression: 24,
    events: [],
    breathingCycles: 0
  };

  const messages = {
    low: {
      label: "把重量分一点给我",
      text: "今天不用立刻变好。先在这里停一会儿，也算照顾自己。"
    },
    calm: {
      label: "安静地亮着",
      text: "摸摸我，或者陪我呼吸一会儿。"
    },
    bright: {
      label: "接住了一点光",
      text: "这束光先替今天的你留着，想分享时再告诉我。"
    },
    tired: {
      label: "慢一点也没关系",
      text: "我把光调暗了一点。现在更适合休息，而不是继续硬撑。"
    }
  };

  const moodCopy = {
    low: "它没有催你振作，只把颜色变得柔软了一些。",
    calm: "呼吸正在回到一个更容易被身体接受的速度。",
    bright: "它接住了今天的一点亮色，也替你保留了这次感受。",
    tired: "能量偏低时，减少刺激本身就是一种照顾。"
  };

  const actionMeta = {
    touch: { icon: "抚", title: "摸了摸小映", fallback: "联结增加了一点" },
    breath: { icon: "息", title: "完成呼吸练习", fallback: "身体收到了一次慢下来的信号" },
    voice: { icon: "语", title: "说了一句话", fallback: "语气被转成了一束光" },
    motion: { icon: "摇", title: "轻摇互动", fallback: "动作让小映换了一个姿势" },
    checkin: { icon: "记", title: "标记了此刻", fallback: "这次感受只留在本机" }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...initialState };
      const parsed = JSON.parse(raw);
      if (parsed.date !== dateKey) return { ...initialState };
      return { ...initialState, ...parsed, events: Array.isArray(parsed.events) ? parsed.events.slice(0, 12) : [] };
    } catch {
      return { ...initialState };
    }
  }

  let state = loadState();
  const query = new URLSearchParams(location.search);
  if (query.get("demo") === "1" && state.events.length === 0) {
    state = {
      ...state,
      mood: "calm",
      calm: 86,
      connection: 74,
      energy: 63,
      stress: 21,
      expression: 42,
      breathingCycles: 1,
      events: [
        { type: "breath", title: "完成 4·2·6 呼吸练习", note: "三轮呼吸，光团从亮到柔", time: "20:16" },
        { type: "touch", title: "摸了摸小映", note: "它向你的手心靠近了一点", time: "20:12" },
        { type: "checkin", title: "标记为“还算稳”", note: "没有解释，只是承认此刻", time: "20:08" }
      ]
    };
  }
  let heartTimer = 0;
  let toastTimer = 0;
  let breathingTimer = 0;
  let speechRecognition = null;
  let speechFallbackTimer = 0;
  let motionEnabled = false;
  let lastShake = 0;
  let activeRhythm = [4, 2, 6];
  let activeRhythmLabel = "4·2·6";

  const stage = $("#companion-stage");
  const companion = $("#companion");
  const pixelField = $("#pixel-field");
  const messageText = $("#message-text");
  const stateLabel = $("#state-label");
  const calmValue = $("#calm-value");
  const connectionValue = $("#connection-value");
  const energyValue = $("#energy-value");
  const voiceDialog = $("#voice-dialog");
  const settingsDialog = $("#settings-dialog");
  const voiceStatus = $("#voice-status");
  const voiceVisual = $("#voice-visual");
  const startVoiceButton = $("#start-voice");
  const toast = $("#toast");

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast("浏览器未允许保存本地记录");
    }
  }

  function showToast(text) {
    window.clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function setMessage(label, text) {
    stateLabel.textContent = label;
    messageText.textContent = text;
  }

  function setReaction(type) {
    stage.dataset.reaction = type;
    window.setTimeout(() => {
      if (stage.dataset.reaction === type) stage.dataset.reaction = "";
    }, type === "soft" ? 1100 : 700);
  }

  function spawnParticles(count = 10, originX = 50, originY = 47) {
    const colors = ["#fff0a5", "#f2b39e", "#9ed6ba", "#d9cbef"];
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const distance = 38 + Math.random() * 80;
      particle.className = "pixel";
      particle.style.left = `${originX + (Math.random() - 0.5) * 13}%`;
      particle.style.top = `${originY + (Math.random() - 0.5) * 15}%`;
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--pixel-color", randomItem(colors));
      particle.style.animationDelay = `${Math.random() * 100}ms`;
      pixelField.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1050);
    }
  }

  function updateReadout() {
    calmValue.textContent = Math.round(state.calm);
    connectionValue.textContent = Math.round(state.connection);
    energyValue.textContent = Math.round(state.energy);
    companion.dataset.mood = state.mood;

    const values = {
      energy: state.energy,
      connection: state.connection,
      stress: state.stress,
      calm: state.calm,
      expression: state.expression
    };
    const columns = $$(".chart-column", $("#mini-chart"));
    columns.forEach((column) => {
      const key = column.querySelector("small")?.textContent;
      const keyMap = { "电量": "energy", "联结": "connection", "压力": "stress", "安定": "calm", "表达": "expression" };
      const value = values[keyMap[key]];
      column.querySelector("span").style.setProperty("--h", `${clamp(value, 8, 100)}%`);
    });

    $("#memory-list").setAttribute("data-count", String(state.events.length));
    $("#storage-status").textContent = state.events.length
      ? `${state.events.length} 条记录，仅保存在此浏览器`
      : "仅保存在此浏览器";
    renderMemory();
    renderInsight();
  }

  function renderInsight() {
    const insightTitle = $("#insight-title");
    const insightCopy = $("#insight-copy");
    const cardCopy = $("#card-copy");
    if (!state.events.length) {
      insightTitle.textContent = "小映在等你靠近";
      insightCopy.textContent = "你还没有开始互动。摸一摸小映，或完成一轮呼吸，这里会留下只属于本次体验的轨迹。";
      cardCopy.textContent = "小映会根据本次互动生成一张抽象视觉卡。图像在手机本地绘制，不上传。";
      return;
    }

    if (state.calm >= 80) {
      insightTitle.textContent = "小映的呼吸变稳了";
      insightCopy.textContent = "这次互动让它的光变柔和，也让“安定”成为当前最明显的变化。你可以继续，也可以在这里停下。";
    } else if (state.connection >= 70) {
      insightTitle.textContent = "它更靠近你了";
      insightCopy.textContent = "触摸与回应提高了联结感。相比追求更高的分数，愿意主动靠近本身就是一次有效的调节行为。";
    } else {
      insightTitle.textContent = "留下了一点可回看的痕迹";
      insightCopy.textContent = "这次变化不需要被解释成好或坏。它记录了你在当下采取过什么行动，以及分身如何回应。";
    }
    cardCopy.textContent = moodCopy[state.mood];
  }

  function renderMemory() {
    const list = $("#memory-list");
    list.replaceChildren();
    if (!state.events.length) {
      const empty = document.createElement("div");
      empty.className = "empty-memory";
      const plus = document.createElement("span");
      plus.setAttribute("aria-hidden", "true");
      plus.textContent = "＋";
      const copy = document.createElement("p");
      copy.textContent = "一次触摸、一次呼吸，都会成为这里的一颗小光点。";
      empty.append(plus, copy);
      list.appendChild(empty);
      return;
    }

    state.events.slice(0, 6).forEach((event) => {
      const item = document.createElement("div");
      item.className = "memory-item";
      const dot = document.createElement("span");
      dot.className = "memory-dot";
      dot.textContent = actionMeta[event.type]?.icon || "光";
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = event.title;
      const note = document.createElement("p");
      note.textContent = `${event.time} · ${event.note}`;
      text.append(title, note);
      item.append(dot, text);
      list.appendChild(item);
    });
  }

  function recordEvent(type, title, note) {
    const time = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
    state.events.unshift({
      type,
      title: title || actionMeta[type]?.title || "一次互动",
      note: note || actionMeta[type]?.fallback || "留下了一点光",
      time
    });
    state.events = state.events.slice(0, 12);
    saveState();
    updateReadout();
  }

  function applyChange(changes, reaction = "happy", moodOverride = null) {
    Object.entries(changes).forEach(([key, amount]) => {
      state[key] = clamp((Number(state[key]) || 0) + amount);
    });
    if (moodOverride) {
      state.mood = moodOverride;
      saveState();
    } else {
      eventLabelForState();
    }
    updateReadout();
    setReaction(reaction);
  }

  function eventLabelForState() {
    if (state.stress >= 70 || state.calm <= 35) {
      state.mood = "low";
    } else if (state.energy <= 32) {
      state.mood = "tired";
    } else if (state.calm >= 82 || state.expression >= 52) {
      state.mood = "bright";
    } else {
      state.mood = "calm";
    }
    const copy = messages[state.mood];
    setMessage(copy.label, copy.text);
    saveState();
  }

  function performPet(source = "button") {
    const now = Date.now();
    if (now - heartTimer < 260 && source === "gesture") return;
    heartTimer = now;
    applyChange({ connection: 7, calm: 3, stress: -5 }, "happy");
    spawnParticles(source === "gesture" ? 9 : 12);
    const copy = randomItem([
      "它向你的手心靠近了一点。",
      "一小块紧绷松开，变成了光点。",
      "小映记住了这次轻轻的触碰。",
      "你们之间的联结变亮了一点。"
    ]);
    setMessage("收到一次轻触", copy);
    if (source === "button") {
      recordEvent("touch", "摸了摸小映", copy);
      showToast("触摸已记录，本机保存");
    }
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function showView(name, syncHash = true) {
    const target = $(`.view[data-view="${name}"]`);
    if (!target) return;
    $$(".view").forEach((view) => view.classList.toggle("is-active", view === target));
    $$(".tab").forEach((tab) => {
      const selected = tab.dataset.target === name;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    });
    if (name !== "breath") stopBreathing(false);
    if (syncHash && location.hash !== `#${name}`) {
      history.replaceState(null, "", `#${name}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    target.focus({ preventScroll: true });
  }

  function setMood(mood, announce = true) {
    state.selectedMood = mood;
    state.mood = mood;
    if (mood === "low") {
      Object.assign(state, { calm: 38, connection: 52, energy: 34, stress: 69, expression: 18 });
    } else if (mood === "bright") {
      Object.assign(state, { calm: 78, connection: 64, energy: 79, stress: 27, expression: 51 });
    } else {
      Object.assign(state, { calm: 72, connection: 45, energy: 58, stress: 32, expression: 24 });
    }
    $$(".mood-chip").forEach((button) => {
      const selected = button.dataset.mood === mood;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const copy = messages[mood];
    setMessage(copy.label, copy.text);
    updateReadout();
    spawnParticles(10, 50, 49);
    setReaction("soft");
    saveState();
    if (announce) {
      const labels = { low: "有点低", calm: "还算稳", bright: "有光" };
      recordEvent("checkin", `标记为“${labels[mood]}”`, "没有解释，只是承认此刻");
      showToast("这次感受只留在本机");
    }
  }

  function openVoiceDialog() {
    voiceStatus.textContent = "点击下方按钮开始。原型不会把语音内容保存在服务器。";
    voiceVisual.classList.remove("is-listening");
    startVoiceButton.disabled = false;
    startVoiceButton.textContent = "开始说话";
    if (typeof voiceDialog.showModal === "function") voiceDialog.showModal();
    else voiceDialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog === voiceDialog) stopSpeech();
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function analyzeVoice(text) {
    const normalized = text.replace(/\s/g, "");
    if (/累|烦|难过|压力|焦虑|不想|崩溃/.test(normalized)) {
      applyChange({ expression: 10, connection: 8, stress: 4, energy: -2 }, "soft", "tired");
      setMessage("听见了你的疲惫", "先不急着解决所有事。我们把这一句话放在这里，陪你慢一点。");
      return "那句“有点累”被留在柔软的颜色里。";
    }
    if (/开心|高兴|不错|顺利|喜欢|太好/.test(normalized)) {
      applyChange({ expression: 12, connection: 8, calm: 3 }, "happy", "bright");
      setMessage("接住了一点亮色", "这束光先替今天的你留着，想分享时再告诉我。");
      return "你的语气让小映亮了一格。";
    }
    applyChange({ expression: 9, connection: 6, stress: -3 }, "soft");
    setMessage("听见了", "你不需要把它说得完全准确。说出来本身，已经改变了这一小段时间。");
    return "一句话被转成了一圈柔和的光。";
  }

  function stopSpeech() {
    window.clearTimeout(speechFallbackTimer);
    voiceVisual.classList.remove("is-listening");
    startVoiceButton.disabled = false;
    startVoiceButton.textContent = "再说一次";
    if (speechRecognition) {
      try { speechRecognition.abort(); } catch { /* no-op */ }
      speechRecognition = null;
    }
  }

  async function startVoice() {
    startVoiceButton.disabled = true;
    startVoiceButton.textContent = "正在听";
    voiceVisual.classList.add("is-listening");
    voiceStatus.textContent = "正在听你说。请靠近手机，慢慢说一句话。";

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      speechFallbackTimer = window.setTimeout(() => {
        const demoText = "今天有一点累，但还想把事情做完。";
        const result = analyzeVoice(demoText);
        voiceStatus.textContent = `当前浏览器不支持语音识别，已进入演示：${demoText} ${result}`;
        voiceVisual.classList.remove("is-listening");
        startVoiceButton.disabled = false;
        startVoiceButton.textContent = "再体验一次";
        recordEvent("voice", "语音交互演示", "浏览器未提供语音识别能力");
      }, 2400);
      return;
    }

    try {
      speechRecognition = new Recognition();
      speechRecognition.lang = "zh-CN";
      speechRecognition.interimResults = false;
      speechRecognition.maxAlternatives = 1;
      speechRecognition.continuous = false;

      speechRecognition.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript?.trim() || "我说了一句话";
        const result = analyzeVoice(text);
        voiceStatus.textContent = `我听见了：“${text}” ${result}`;
        recordEvent("voice", "对小映说了一句话", result);
      };

      speechRecognition.onerror = () => {
        voiceStatus.textContent = "没有获取到清晰语音。你仍然可以直接标记此刻的感受，或用“今天有一点累”作为演示文本继续体验。";
        const fallback = "今天有一点累，但还想把事情做完。";
        const result = analyzeVoice(fallback);
        recordEvent("voice", "语音交互演示", result);
      };

      speechRecognition.onend = () => {
        voiceVisual.classList.remove("is-listening");
        startVoiceButton.disabled = false;
        startVoiceButton.textContent = "再说一次";
        speechRecognition = null;
      };

      speechRecognition.start();
    } catch {
      voiceVisual.classList.remove("is-listening");
      startVoiceButton.disabled = false;
      startVoiceButton.textContent = "再体验一次";
      voiceStatus.textContent = "当前环境未启动语音识别，请直接用手势或标记完成体验。";
    }
  }

  function handleShake(source = "sensor") {
    applyChange({ energy: -2, expression: 7, connection: 4, stress: source === "sensor" ? -4 : 0 }, "soft");
    spawnParticles(16, 50, 47);
    setMessage("被轻轻摇了一下", "小映换了一个更靠近你的姿势。这次动作只用于互动，不会持续读取手机状态。");
    recordEvent("motion", source === "sensor" ? "摇动手机" : "体验轻摇互动", "动作变成了一次回应");
    showToast(source === "sensor" ? "已捕捉到一次摇动" : "已模拟一次轻摇");
    if (navigator.vibrate) navigator.vibrate([18, 30, 18]);
  }

  async function enableMotion() {
    const motionStatus = $("#motion-status");
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        motionStatus.textContent = "等待系统授权";
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== "granted") {
          motionStatus.textContent = "权限未开启";
          showToast("未获得体感权限，仍可点按“轻摇”体验");
          return false;
        }
      }
      if (typeof DeviceMotionEvent === "undefined") {
        motionStatus.textContent = "此设备不支持体感，可点按体验";
        return false;
      }
      motionEnabled = true;
      motionStatus.textContent = "已开启，摇一摇手机";
      $("#enable-motion").textContent = "已开启";
      $("#enable-motion").disabled = true;
      showToast("体感互动已开启");
      return true;
    } catch {
      motionStatus.textContent = "授权失败，可点按体验";
      showToast("体感授权未完成");
      return false;
    }
  }

  function onDeviceMotion(event) {
    if (!motionEnabled) return;
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;
    const magnitude = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
    const now = Date.now();
    if (magnitude > 36 && now - lastShake > 1600) {
      lastShake = now;
      handleShake("sensor");
    }
  }

  function bindPetting() {
    let activePointer = null;
    let lastX = 0;
    let lastY = 0;
    let distance = 0;

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      activePointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      distance = 0;
      stage.dataset.pressed = "true";
      stage.setPointerCapture?.(event.pointerId);
      spawnParticles(4, ((event.clientX - stage.getBoundingClientRect().left) / stage.clientWidth) * 100, ((event.clientY - stage.getBoundingClientRect().top) / stage.clientHeight) * 100);
    });

    stage.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointer) return;
      const delta = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      distance += delta;
      lastX = event.clientX;
      lastY = event.clientY;
      if (distance > 55) {
        performPet("gesture");
        distance = 0;
      }
    });

    const release = (event) => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      stage.dataset.pressed = "false";
      if (distance < 18) performPet("gesture");
    };

    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", () => {
      activePointer = null;
      stage.dataset.pressed = "false";
    });
  }

  function breathPause(ms) {
    return new Promise((resolve) => {
      breathingTimer = window.setTimeout(resolve, ms);
    });
  }

  function stopBreathing(announce = true) {
    if (!breathingTimer) return;
    window.clearTimeout(breathingTimer);
    breathingTimer = 0;
    const orb = $("#breath-orb");
    orb.className = "breath-orb";
    $("#breath-phase").textContent = "准备好时";
    $("#breath-count").textContent = "4";
    $("#breath-hint").textContent = "轻点开始";
    $("#toggle-breath").textContent = "开始一轮呼吸";
    $("#practice-note").textContent = "完成一轮后，小映会记录一次陪伴，并把它画进今天的情绪卡。";
    if (announce) showToast("已停止，随时可以重新开始");
  }

  async function runBreathing() {
    const button = $("#toggle-breath");
    const orb = $("#breath-orb");
    const phaseLabel = $("#breath-phase");
    const countLabel = $("#breath-count");
    const hintLabel = $("#breath-hint");
    const note = $("#practice-note");
    const phases = [
      { key: "inhale", label: "慢慢吸气", duration: activeRhythm[0], hint: "让光团变大" },
      { key: "hold", label: "轻轻停留", duration: activeRhythm[1], hint: "不用用力" },
      { key: "exhale", label: "缓缓呼气", duration: activeRhythm[2], hint: "让肩膀松下来" }
    ];

    button.textContent = "停止";
    note.textContent = "这一轮会持续约半分钟。任何时候都可以停止，不需要完成得完美。";

    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (const phase of phases) {
        if (!breathingTimer) return;
        orb.className = `breath-orb is-${phase.key}`;
        phaseLabel.textContent = phase.label;
        hintLabel.textContent = phase.hint;
        for (let second = phase.duration; second > 0; second -= 1) {
          if (!breathingTimer) return;
          countLabel.textContent = String(second);
          await breathPause(1000);
        }
      }
    }

    breathingTimer = 0;
    orb.className = "breath-orb";
    phaseLabel.textContent = "完成了";
    countLabel.textContent = "✓";
    hintLabel.textContent = "把这点安定带走";
    button.textContent = "再做一轮";
    note.textContent = "这一次呼吸已经留在本机记录里。你可以继续，也可以去做别的事。";
    state.breathingCycles += 1;
    applyChange({ calm: 13, stress: -16, energy: 3, connection: 5 }, "soft");
    setMessage("刚刚一起慢下来", "不需要立刻变好。能把呼吸放慢一点，就已经是在回应自己。");
    recordEvent("breath", `完成${activeRhythmLabel}呼吸练习`, "三轮呼吸，光团从亮到柔");
    spawnParticles(14, 50, 46);
    if (navigator.vibrate) navigator.vibrate([24, 40, 24]);
  }

  function toggleBreathing() {
    if (breathingTimer) {
      stopBreathing();
      return;
    }
    breathingTimer = 1;
    runBreathing();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawCreature(ctx, x, y) {
    const palette = {
      low: ["#ffeacb", "#e7a28e", "#bd7776"],
      calm: ["#f2f9c8", "#9fd5b7", "#66ab96"],
      bright: ["#fff4a7", "#c8e486", "#75b99a"],
      tired: ["#f0e8ff", "#b9a7d9", "#8374a8"]
    }[state.mood] || ["#f2f9c8", "#9fd5b7", "#66ab96"];

    const aura = ctx.createRadialGradient(x, y, 40, x, y, 210);
    aura.addColorStop(0, "rgba(255,255,235,.9)");
    aura.addColorStop(0.5, "rgba(174,220,196,.45)");
    aura.addColorStop(1, "rgba(174,220,196,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, 210, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(x - 110, y - 120, x + 100, y + 130);
    body.addColorStop(0, palette[0]);
    body.addColorStop(0.48, palette[1]);
    body.addColorStop(1, palette[2]);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x, y - 118);
    ctx.bezierCurveTo(x + 75, y - 118, x + 142, y - 55, x + 142, y + 10);
    ctx.bezierCurveTo(x + 142, y + 88, x + 83, y + 137, x, y + 137);
    ctx.bezierCurveTo(x - 84, y + 137, x - 142, y + 88, x - 142, y + 10);
    ctx.bezierCurveTo(x - 142, y - 59, x - 76, y - 118, x, y - 118);
    ctx.fill();

    ctx.fillStyle = "#20342e";
    ctx.beginPath();
    ctx.ellipse(x - 43, y - 5, 12, 17, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 43, y - 5, 12, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffdf5";
    ctx.beginPath();
    ctx.arc(x - 39, y - 10, 4, 0, Math.PI * 2);
    ctx.arc(x + 47, y - 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#20342e";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (state.mood === "low" || state.mood === "tired") {
      ctx.moveTo(x - 15, y + 44);
      ctx.quadraticCurveTo(x, y + 34, x + 15, y + 44);
    } else if (state.mood === "bright") {
      ctx.arc(x, y + 42, 12, 0, Math.PI);
    } else {
      ctx.moveTo(x - 14, y + 42);
      ctx.quadraticCurveTo(x, y + 52, x + 14, y + 42);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(241,154,132,.35)";
    ctx.beginPath();
    ctx.ellipse(x - 78, y + 37, 25, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 78, y + 37, 25, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function generateEmotionCard(shouldDownload = true) {
    const canvas = $("#card-canvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, state.mood === "low" ? "#f7d9c9" : state.mood === "tired" ? "#ddd4ee" : "#f7f1dd");
    bg.addColorStop(0.58, state.mood === "bright" ? "#c8e5b1" : "#b8ddcd");
    bg.addColorStop(1, state.mood === "low" ? "#c7a9b9" : state.mood === "tired" ? "#9f91bf" : "#72ac99");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.16;
    for (let index = 0; index < 180; index += 1) {
      const x = (index * 83) % width;
      const y = (index * index * 7) % height;
      ctx.fillStyle = index % 3 === 0 ? "#fff9d9" : "#315548";
      ctx.fillRect(x, y, index % 4 === 0 ? 5 : 2, index % 4 === 0 ? 5 : 2);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255,250,240,.82)";
    roundedRect(ctx, 72, 70, 936, 1300, 54);
    ctx.fill();

    ctx.fillStyle = "#20342e";
    ctx.font = '800 28px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText("映心 · 今日情绪卡", 120, 142);

    ctx.fillStyle = "rgba(32,50,44,.55)";
    ctx.font = '400 19px "Microsoft YaHei", "PingFang SC", sans-serif';
    const dateText = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date());
    ctx.fillText(dateText, 120, 180);

    drawCreature(ctx, width / 2, 500);

    ctx.textAlign = "center";
    ctx.fillStyle = "#20342e";
    ctx.font = '800 55px "Microsoft YaHei", "PingFang SC", sans-serif';
    const title = {
      low: "先允许今天有一点重",
      calm: "变化不必很大",
      bright: "把这点亮色留给明天",
      tired: "慢一点也算在向前"
    }[state.mood];
    ctx.fillText(title, width / 2, 810);

    ctx.fillStyle = "rgba(32,50,44,.64)";
    ctx.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif';
    const body = moodCopy[state.mood];
    wrapCanvasText(ctx, body, width / 2, 860, 680, 40);

    const labels = [
      ["安定", state.calm],
      ["联结", state.connection],
      ["电量", state.energy]
    ];
    labels.forEach(([label, value], index) => {
      const x = 188 + index * 352;
      ctx.fillStyle = "#20342e";
      ctx.font = '700 52px Georgia, serif';
      ctx.fillText(String(Math.round(value)), x, 1042);
      ctx.fillStyle = "rgba(32,50,44,.55)";
      ctx.font = '400 19px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.fillText(label, x, 1075);
      ctx.strokeStyle = "rgba(32,50,44,.14)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x - 74, 1100);
      ctx.lineTo(x + 74, 1100);
      ctx.stroke();
      ctx.strokeStyle = "#427b69";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x - 74, 1100);
      ctx.lineTo(x - 74 + (148 * clamp(value) / 100), 1100);
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(32,50,44,.52)";
    ctx.font = '400 18px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText("这不是情绪诊断，只是一次被看见的互动", width / 2, 1250);
    ctx.fillStyle = "#20342e";
    ctx.font = '700 19px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText("YINGXIN · ECHO", width / 2, 1302);

    if (shouldDownload) {
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast("卡片生成失败，请稍后再试");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `映心情绪卡-${dateKey}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1800);
        showToast("情绪卡已在本地生成");
      }, "image/png");
    }
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = "";
    const lines = [];
    for (const char of text) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  }

  function bindEvents() {
    $$(".tab").forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.target)));
    $$(".back-home").forEach((button) => button.addEventListener("click", () => showView("home")));
    $$(".action-button").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "pet") performPet("button");
        if (action === "breath") showView("breath");
        if (action === "voice") openVoiceDialog();
        if (action === "motion") {
          if (motionEnabled) {
            showToast("摇一摇手机试试");
          } else if (typeof DeviceMotionEvent !== "undefined") {
            enableMotion().then((enabled) => {
              if (!enabled) handleShake("button");
            });
          } else {
            handleShake("button");
          }
        }
      });
    });

    $$(".mood-chip").forEach((button) => {
      button.addEventListener("click", () => setMood(button.dataset.mood));
    });

    $$(".mode-chip").forEach((button) => {
      button.addEventListener("click", () => {
        if (breathingTimer) stopBreathing(false);
        activeRhythm = button.dataset.rhythm.split("-").map(Number);
        activeRhythmLabel = button.dataset.rhythm.replaceAll("-", "·");
        $$(".mode-chip").forEach((chip) => chip.classList.toggle("is-selected", chip === button));
        $("#breath-count").textContent = String(activeRhythm[0]);
        $("#practice-note").textContent = `已选择 ${activeRhythmLabel} 节奏。轻点开始，跟随光团即可。`;
      });
    });

    $("#toggle-breath").addEventListener("click", toggleBreathing);
    $("#start-voice").addEventListener("click", startVoice);
    $("#generate-card").addEventListener("click", () => generateEmotionCard(true));
    $("#download-card").addEventListener("click", () => generateEmotionCard(true));
    $("#open-settings").addEventListener("click", () => settingsDialog.showModal());
    $("#enable-motion").addEventListener("click", enableMotion);

    $$("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(document.getElementById(button.dataset.close)));
    });

    [voiceDialog, settingsDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        const rect = dialog.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) closeDialog(dialog);
      });
      dialog.addEventListener("cancel", () => stopSpeech());
    });

    $("#clear-storage").addEventListener("click", () => {
      const shouldClear = window.confirm("清除本次设备上的互动记录与状态？此操作不可撤销。");
      if (!shouldClear) return;
      localStorage.removeItem(STORAGE_KEY);
      state = { ...initialState, events: [] };
      setMood("calm", false);
      settingsDialog.close();
      showToast("本地记录已清除");
    });

    window.addEventListener("devicemotion", onDeviceMotion, { passive: true });
    window.addEventListener("hashchange", () => {
      const requested = location.hash.slice(1);
      if (["home", "breath", "journey"].includes(requested)) showView(requested, false);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopBreathing(false);
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* The static page remains usable without offline caching. */
    });
  }

  function init() {
    state.selectedMood = state.selectedMood || "calm";
    state.mood = state.mood || state.selectedMood;
    const copy = messages[state.mood] || messages.calm;
    setMessage(copy.label, copy.text);
    updateReadout();
    bindPetting();
    bindEvents();
    $$(".mood-chip").forEach((button) => {
      const selected = button.dataset.mood === state.selectedMood;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("#session-date").textContent = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric"
    }).format(new Date());
    const requestedView = location.hash.slice(1);
    if (["breath", "journey"].includes(requestedView)) showView(requestedView, false);
    registerServiceWorker();
  }

  init();
})();
