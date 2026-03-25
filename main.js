let cards = {};
let characters = {};

// ===== 所持 =====
let ownedChars = new Set();
let ownedSC = new Set();

// ===== 選択 =====
let selectedChars = [];
let selectedSC = [];

// ===== 確率 =====
const rates = { N:0.7, R:0.25, SR:0.05 };

// ===== データ読み込み =====
async function loadData(){
  cards = await fetch("data/cards.json").then(r=>r.json());
  characters = await fetch("data/characters.json").then(r=>r.json());
}
loadData();

// ===== 画面 =====
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===== ガチャ =====
function getRarity(){
  const r=Math.random();
  if(r<rates.SR)return"SR";
  if(r<rates.SR+rates.R)return"R";
  return"N";
}

function drawCharacter(){
  const rarity=getRarity();
  const pool=Object.keys(characters).filter(id=>characters[id].rarity===rarity);
  return pool[Math.floor(Math.random()*pool.length)];
}

// 単発UI
function drawCharacterUI(){
  const id=drawCharacter();
  ownedChars.add(id);
  updateOwned();
}

// 10連UI
function draw10UI(){
  let results=[];

  for(let i=0;i<10;i++){
    let id=drawCharacter();

    if(i===9 && !results.some(r=>characters[r].rarity==="SR")){
      const srPool=Object.keys(characters).filter(id=>characters[id].rarity==="SR");
      id=srPool[Math.floor(Math.random()*srPool.length)];
    }

    results.push(id);
    ownedChars.add(id);
  }

  alert("10連結果:\n"+results.map(id=>characters[id].name).join("\n"));
  updateOwned();
}

// ===== 所持表示 =====
function updateOwned(){
  ownedCharsDiv.innerHTML="";
  ownedChars.forEach(id=>{
    const div=document.createElement("div");
    div.textContent=characters[id].name;
    ownedCharsDiv.appendChild(div);
  });
}

// ===== 画面遷移 =====
function goSelect(){
  renderSelect();
  showScreen("selectScreen");
}

function goGacha(){
  showScreen("gachaScreen");
}

// ===== 編成 =====
function renderSelect(){
  charSelect.innerHTML="";

  ownedChars.forEach(id=>{
    const div=document.createElement("div");
    div.className="char";
    div.textContent=characters[id].name;

    div.onclick=()=>{
      if(selectedChars.includes(id)){
        selectedChars=selectedChars.filter(x=>x!==id);
        div.classList.remove("selected");
      }else if(selectedChars.length<4){
        selectedChars.push(id);
        div.classList.add("selected");
      }
    };

    charSelect.appendChild(div);
  });
}

// ===== バトル =====
class Battle{
  constructor(deck){
    this.playerHP=100;
    this.enemyHP=100;
    this.enemyAttack=10;

    this.deck=deck.sort(()=>Math.random()-0.5);
    this.hand=[];
    this.actionCount=1;
  }

  draw(){
    while(this.hand.length<3 && this.deck.length){
      this.hand.push(this.deck.pop());
    }
  }

  startTurn(){
    this.actionCount=1;
    this.draw();
    updateUI();
  }

  useCard(i){
    if(this.actionCount<=0)return;

    const id=this.hand.splice(i,1)[0];
    const c=cards[id];

    if(c.type==="attack") this.enemyHP-=c.power;
    if(c.type==="heal") this.playerHP+=c.power;
    if(c.type==="special") this.actionCount++;

    this.deck.push(id);
    this.actionCount--;

    updateUI();
  }

  enemyTurn(){
    this.playerHP-=this.enemyAttack;
  }

  endTurn(){
    this.deck.push(...this.hand);
    this.hand=[];
    this.enemyTurn();
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

  hand.innerHTML="";
  battle.hand.forEach((id,i)=>{
    const c=cards[id];
    const div=document.createElement("div");
    div.className="card "+c.type;
    div.textContent=c.name;
    div.onclick=()=>battle.useCard(i);
    hand.appendChild(div);
  });
}

function nextTurn(){ battle.endTurn(); }

// DOM
const ownedCharsDiv=document.getElementById("ownedChars");
