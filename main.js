// ===== データ =====
let cards = {};
let characters = {};

// ===== 所持（Set → 配列保存）=====
let ownedChars = new Set();
let ownedSC = new Set(); // ★追加: SCの所持状態

// ===== 編成 =====
let selectedChars = [];
let selectedSC = []; // ★追加: (将来のSC編成用)

// ===== 確率 =====
const rates = { N:0.7, R:0.25, SR:0.05 };

// ===== ロード =====
async function loadData(){
  cards = await fetch("data/cards.json").then(r=>r.json());
  characters = await fetch("data/characters.json").then(r=>r.json());

  loadSave(); // ← ここ重要
}
loadData();

// ===== セーブ =====
function saveGame(){
  const data = {
    ownedChars: [...ownedChars],
    selectedChars: selectedChars,
    ownedSC: [...ownedSC],     // ★追加
    selectedSC: selectedSC     // ★追加
  };
  localStorage.setItem("myGameSave", JSON.stringify(data));
}

// ===== ロード =====
function loadSave(){
  const data = JSON.parse(localStorage.getItem("myGameSave"));

  if(!data) return;

  ownedChars = new Set(data.ownedChars || []);
  selectedChars = data.selectedChars || [];
  ownedSC = new Set(data.ownedSC || []); // ★追加
  selectedSC = data.selectedSC || [];    // ★追加

  updateOwned();
}

// ===== 画面 =====
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== ガチャの内部処理 =====
function drawGachaItem(forceSR = false) {
  let rarity = forceSR ? "SR" : getRarity();
  
  // 該当レアリティのキャラクター候補
  const charCandidates = Object.keys(characters).filter(k => characters[k].rarity === rarity);
  
  // 該当レアリティのSC候補
  const scCandidates = Object.keys(cards).filter(k => cards[k].isSC && cards[k].rarity === rarity);
  
  // 候補をすべて混ぜる
  const allCandidates = [];
  charCandidates.forEach(id => allCandidates.push({ type: "char", id: id }));
  scCandidates.forEach(id => allCandidates.push({ type: "sc", id: id }));

  // もし該当レアリティが空なら、安全のためにNキャラを返す
  if (allCandidates.length === 0) {
    const fallback = Object.keys(characters)[0];
    return { type: "char", id: fallback, name: characters[fallback].name, rarity: "N" };
  }

  // ランダムに1つ選ぶ
  const picked = allCandidates[Math.floor(Math.random() * allCandidates.length)];

  if (picked.type === "char") {
    ownedChars.add(picked.id);
    return { type: "char", id: picked.id, name: characters[picked.id].name, rarity: rarity };
  } else {
    ownedSC.add(picked.id);
    return { type: "sc", id: picked.id, name: cards[picked.id].name, rarity: rarity };
  }
}

// ===== ガチャUI処理 =====
function drawCharacterUI() {
  const result = drawGachaItem();
  const typeText = result.type === "char" ? "キャラ" : "SC";
  alert(`【単発ガチャ】\n[${result.rarity}] ${result.name} (${typeText}) をゲットしました！`);
  updateOwned();
}

function draw10UI() {
  let resultsText = "【10連ガチャ結果】\n";
  let hasSR = false;

  for (let i = 0; i < 9; i++) {
    const result = drawGachaItem();
    if (result.rarity === "SR") hasSR = true;
    const typeText = result.type === "char" ? "キャラ" : "SC";
    resultsText += `[${result.rarity}] ${result.name} (${typeText})\n`;
  }

  // 10連目はSR確定枠の処理（今までSRが出ていなければ強制的にSR）
  const lastResult = drawGachaItem(!hasSR);
  const lastTypeText = lastResult.type === "char" ? "キャラ" : "SC";
  resultsText += `[${lastResult.rarity}] ${lastResult.name} (${lastTypeText})\n`;

  alert(resultsText);
  updateOwned();
}

// ===== 所持一覧の表示更新 =====
function updateOwned() {
  const charsDiv = document.getElementById("ownedChars");
  const scDiv = document.getElementById("ownedSC");
  
  if (charsDiv) {
    charsDiv.innerHTML = "";
    ownedChars.forEach(id => {
      const char = characters[id];
      if(!char) return;
      const div = document.createElement("div");
      div.className = "char";
      div.textContent = `[${char.rarity}] ${char.name}`;
      charsDiv.appendChild(div);
    });
  }

  // ★追加: SCの表示
  if (scDiv) {
    scDiv.innerHTML = "";
    ownedSC.forEach(id => {
      const c = cards[id];
      if(!c) return;
      const div = document.createElement("div");
      div.className = "card " + c.type;
      
      const nameDiv = document.createElement("div");
      nameDiv.className = "card-name";
      nameDiv.textContent = `[${c.rarity}] ${c.name}`;
      
      div.appendChild(nameDiv);
      scDiv.appendChild(div);
    });
  }

  saveGame();
}

// ===== 編成 =====
function goSelect(){
  renderSelect();
  showScreen("selectScreen");
}

function goGacha(){
  showScreen("gachaScreen");
}

function renderSelect(){
  charSelect.innerHTML="";

  ownedChars.forEach(id=>{
    const div=document.createElement("div");
    div.className="char";
    div.textContent=characters[id].name;

    // ★ 選択状態復元
    if(selectedChars.includes(id)) {
      div.classList.add("selected");
    }

    div.onclick=()=>{
      if(selectedChars.includes(id)){
        selectedChars=selectedChars.filter(x=>x!==id);
        div.classList.remove("selected");
      }else if(selectedChars.length<4){
        selectedChars.push(id);
        div.classList.add("selected");
      }

      saveGame(); // ★追加
    };

    charSelect.appendChild(div);
  });
}

// ===== バトル =====
class Battle {
  constructor(deck){
    this.playerHP=100;
    this.enemyHP=100;
    this.enemyAttack=10;

    // ★追加: 被ダメ増加（永続）の管理変数
    this.playerDamageTakenUp = 0; 
    this.enemyDamageTakenUp = 0;

    this.deck=deck.sort(()=>Math.random()-0.5);
    this.hand=[];
    this.actionCount=1;
    this.buffs = [];
    this.debuffs = [];
    this.enemyStatus = [];
  }

  getAttackModifier() {
    let buff = this.buffs.filter(b => b.stat === "attack").reduce((sum, b) => sum + b.value, 0);
    let debuff = this.debuffs.filter(b => b.stat === "attack").reduce((sum, b) => sum + b.value, 0);
    return buff + debuff;
  }

  draw(){
    // ★修正: 手札の上限（3枚）の制限を外し、引けるだけ引くように変更
    if(this.deck.length > 0){
      this.hand.push(this.deck.pop());
    }
  }

  startTurn(){
    this.actionCount=1;
    // ターン開始時は手札が3枚になるまで引く
    while(this.hand.length < 3 && this.deck.length > 0){
      this.draw();
    }
    updateUI();
  }

  checkWinLose() {
    if (this.enemyHP <= 0) {
      this.enemyHP = 0;
      updateUI();
      setTimeout(() => { alert("敵を倒した！あなたの勝利です！"); goSelect(); }, 100);
      return true;
    }
    if (this.playerHP <= 0) {
      this.playerHP = 0;
      updateUI();
      setTimeout(() => { alert("敗北しました……。"); goSelect(); }, 100);
      return true;
    }
    return false;
  }

  useCard(i){
    if(this.actionCount<=0) return;
  
    const id=this.hand.splice(i,1)[0];
    const c=cards[id];
  
    // ===== 攻撃 =====
    if(c.type==="attack"){
      // ★修正: 敵の被ダメ増加（永続）を上乗せしてダメージを与える
      let dmg = c.power + this.getAttackModifier() + this.enemyDamageTakenUp;
      this.enemyHP -= dmg;
  
      if(c.effect?.poison){
        this.enemyStatus.push({ type: "poison", value: c.effect.poison, duration: c.effect.duration });
      }
    }
  
    // ===== 回復 =====
    if(c.type==="heal") this.playerHP += c.power;
  
    // ===== バフ / デバフ / 特殊 =====
    if(c.type==="buff") this.buffs.push({ stat: c.effect.stat, value: c.power, duration: c.duration });
    if(c.type==="debuff") this.debuffs.push({ stat: c.effect.stat, value: c.power, duration: c.duration });
    
    // ===== 新効果の処理 =====
    if(c.effect){
      // 行動回数増加
      if(c.effect.extraAction) this.actionCount += c.effect.extraAction;
      
      // カードドロー
      if(c.effect.draw){
        for(let j=0; j<c.effect.draw; j++) this.draw();
      }

      // 被ダメ増加（永続）
      if(c.effect.damageTakenUp){
        if(c.effect.damageTakenUp.target === "enemy") {
          this.enemyDamageTakenUp += c.effect.damageTakenUp.value;
        } else if(c.effect.damageTakenUp.target === "player") {
          this.playerDamageTakenUp += c.effect.damageTakenUp.value;
        }
      }
    }
  
    if(!c.exhaust) this.deck.push(id);
    this.actionCount--;
  
    updateUI();
    this.checkWinLose();
  }
  
  enemyTurn(){
    // ★修正: 自分の被ダメ増加（永続）が上乗せされてダメージを受ける
    let dmg = this.enemyAttack + this.playerDamageTakenUp;
    this.playerHP -= dmg;
  }

  endTurn(){
    this.deck.push(...this.hand);
    this.hand=[];
  
    this.enemyStatus.forEach(s=>{
      if(s.type==="poison") this.enemyHP -= s.value; // 毒には被ダメ増加を乗せない仕様にしています
      s.duration--;
    });
    this.enemyStatus = this.enemyStatus.filter(s=>s.duration>0);
  
    updateUI();
    if(this.checkWinLose()) return;
  
    this.buffs.forEach(b=>b.duration--);
    this.buffs = this.buffs.filter(b=>b.duration>0);
    this.debuffs.forEach(b=>b.duration--);
    this.debuffs = this.debuffs.filter(b=>b.duration>0);
  
    this.enemyTurn();
    if(this.checkWinLose()) return;
  
    this.startTurn();
  }
}
let battle;

// ===== 開始 =====
function startGame(){
  if(selectedChars.length!==4){
    alert("4人選んでください");
    return;
  }

  let deck=[];
  selectedChars.forEach(id=>{
    deck.push(...characters[id].cards);
  });

  battle=new Battle(deck);

  showScreen("battleScreen");
  battle.startTurn();
}

// ===== UI =====
function updateUI(){
  playerHP.textContent=battle.playerHP;
  enemyHP.textContent=battle.enemyHP;
  actionCount.textContent=battle.actionCount;
  const playerStatusDiv = document.getElementById("playerStatus");
  const enemyStatusDiv = document.getElementById("enemyStatus");

  hand.innerHTML="";
  battle.hand.forEach((id,i)=>{
    const c=cards[id];
    const div=document.createElement("div");
    div.className="card "+c.type;
    
    // カード名
    const nameDiv = document.createElement("div");
    nameDiv.className = "card-name";
    nameDiv.textContent = c.name;
    
    // カード効果
    const descDiv = document.createElement("div");
    descDiv.className = "card-desc";
    descDiv.innerHTML = getCardDescription(c);
    
    div.appendChild(nameDiv);
    div.appendChild(descDiv);
    
    div.onclick=()=>battle.useCard(i);
    hand.appendChild(div);
  });

  playerStatusDiv.innerHTML = "";
  battle.buffs.forEach(b => {
    const div = document.createElement("div");
    div.className = "status-box buff";
    div.textContent = `${b.stat}+${b.value} (${b.duration})`;
    playerStatusDiv.appendChild(div);
  });
  
  battle.debuffs.forEach(d => {
    const div = document.createElement("div");
    div.className = "status-box debuff";
    div.textContent = `${d.stat}${d.value} (${d.duration})`;
    playerStatusDiv.appendChild(div);
  });
  
  // ===== 敵状態 =====
  enemyStatusDiv.innerHTML = "";
  battle.enemyStatus.forEach(s => {
    const div = document.createElement("div");
    div.className = "status-box poison";
    div.textContent = `${s.type} ${s.value} (${s.duration})`;
    enemyStatusDiv.appendChild(div);
  });
}

function nextTurn(){ battle.endTurn(); }

// DOM
const ownedCharsDiv=document.getElementById("ownedChars");

function getCardDescription(c) {
  let desc = "";
  
  if (c.type === "attack") {
    desc += `ダメージ: ${c.power}`;
    if (c.effect?.poison) {
      desc += `<br>毒付与: ${c.effect.poison} (${c.effect.duration}T)`;
    }
  } else if (c.type === "heal") {
    desc += `回復: ${c.power}`;
  } else if (c.type === "buff" || c.type === "debuff") {
    const statName = c.effect.stat === "attack" ? "攻撃力" : c.effect.stat;
    const sign = c.power > 0 ? "+" : "";
    desc += `${statName}${sign}${c.power} (${c.duration}T)`;
  } else if (c.type === "special") {
    if (c.effect?.extraAction) desc += `行動回数+${c.effect.extraAction}`;
  }

  // 使い切り（除外）フラグの表示
  if (c.exhaust) {
    desc += `<br><span style="color:#f1c40f; font-size:0.9em;">※一度のみ</span>`;
  }
  
  return desc;
}
