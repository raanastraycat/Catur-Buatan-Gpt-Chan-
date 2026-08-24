/* =============== File Mapping =============== */
function pieceToFile(p){
    const map = {
        "K":"white_king.jpg",
        "Q":"white_queen.jpg",
        "R":"white_rook.jpg",
        "B":"white_bishop.jpg",
        "N":"white_knight.jpg",
        "P":"white_pawn.jpg",

        "k":"black_king.jpg",
        "q":"black_queen.jpg",
        "r":"black_rook.jpg",
        "b":"black_bishop.jpg",
        "n":"black_knight.jpg",
        "p":"black_pawn.jpg"
    };
    return map[p];
}

/* =============== Default Board =============== */
const DEFAULT_BOARD = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
];

/* =============== DOM =============== */
const boardDiv = document.getElementById("chessboard");
const turnLabel = document.getElementById("turn");

const promoOverlay = document.getElementById("promotion-overlay");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const botBtn = document.getElementById("botBtn");

/* =============== State =============== */
let board = JSON.parse(JSON.stringify(DEFAULT_BOARD));
let history = [];
let turnWhite = true;

let selected = null;
let validMoves = [];

let playingBot = false;

let gameSeconds = 0;
let timerInterval = null;

/* =============== Helpers =============== */
function isWhite(p){ return p && p === p.toUpperCase(); }
function isBlack(p){ return p && p === p.toLowerCase(); }
function sameTeam(a,b){ return a && b && (isWhite(a) === isWhite(b)); }
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function formatTime(s){
    let h = Math.floor(s / 3600);
    let m = Math.floor((s % 3600) / 60);
    let d = s % 60;

    return (
        (h < 10 ? "0"+h : h) + ":" +
        (m < 10 ? "0"+m : m) + ":" +
        (d < 10 ? "0"+d : d)
    );
}


/* ============================================================
   DRAW BOARD
   ============================================================ */
   startTimer();

function drawBoard(){

    boardDiv.innerHTML = "";

    const whiteCheck = isKingChecked(true);
    const blackCheck = isKingChecked(false);

    for(let r=0; r<8; r++){
        for(let c=0; c<8; c++){
            const sq = document.createElement("div");
            sq.className = "square " + ((r+c)%2===0 ? "light":"dark");

            // highlight check
            if(whiteCheck && whiteCheck.r===r && whiteCheck.c===c){
                sq.classList.add("check");
            }
            if(blackCheck && blackCheck.r===r && blackCheck.c===c){
                sq.classList.add("check");
            }

            // selected
            if(selected && selected.r===r && selected.c===c){
                sq.classList.add("selected");
            }

            // moves
            for(let m of validMoves){
                if(m.r===r && m.c===c){
                    sq.classList.add(m.type==="capture" ? "capture" : "move");
                }
            }

            // piece
            const p = board[r][c];
            if(p){
                const img = document.createElement("img");
                img.src = "img/" + pieceToFile(p);
                img.className = "piece-img";
                sq.appendChild(img);
            }

            sq.addEventListener("click", ()=>onClick(r,c));
            boardDiv.appendChild(sq);
        }
    }

    turnLabel.textContent = turnWhite ? "Bidak Tempur" : "Bidak Musik";
}

/* ============================================================
   CLICK HANDLER
   ============================================================ */
function onClick(r,c){
    const piece = board[r][c];

    // selecting
    if(!selected){
        if(!piece) return;
        if(turnWhite && !isWhite(piece)) return;
        if(!turnWhite && !isBlack(piece)) return;

        selected = {r,c};
        validMoves = getMoves(r,c);
        drawBoard();
        return;
    }

    // unselect
    if(selected.r===r && selected.c===c){
        selected=null;
        validMoves=[];
        drawBoard();
        return;
    }

    // perform move
    const mv = validMoves.find(m => m.r===r && m.c===c);
    if(mv){
        history.push({ board: clone(board), turnWhite });

        board[r][c] = board[selected.r][selected.c];
        board[selected.r][selected.c] = "";

        // promotion
        if(mv.promote){
            openPromo(r,c, board[r][c]);
            selected=null;
            validMoves=[];
            drawBoard();
            return;
        }

        turnWhite = !turnWhite;

        selected=null;
        validMoves=[];
        drawBoard();
        checkCheckmate();

        if(playingBot && !turnWhite){
            setTimeout(botMove, 300);
        }
        return;
    }

    // wrong click → reset
    selected=null;
    validMoves=[];
    drawBoard();
}

/* ============================================================
   MOVEMENT
   ============================================================ */
function getMoves(r1,c1){
    const p = board[r1][c1];
    const moves = [];

    for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
            if(sameTeam(p, board[r][c])) continue;

            if(validStep(r1,c1,r,c)){
                const tmp = clone(board);
                tmp[r][c] = tmp[r1][c1];
                tmp[r1][c1] = "";

                if(!kingInCheckAfter(tmp, isWhite(p))){
                    const mv = {r,c, type: board[r][c] ? "capture":"move"};
                    if(p==="P" && r===0) mv.promote = true;
                    if(p==="p" && r===7) mv.promote = true;
                    moves.push(mv);
                }
            }
        }
    }
    return moves;
}

function validStep(r1,c1,r2,c2){
    const p = board[r1][c1];
    if(!p) return false;

    const dr = r2-r1, dc = c2-c1;
    const t = p.toLowerCase();

    switch(t){
        case "r": return (r1===r2 || c1===c2) && clear(r1,c1,r2,c2);
        case "b": return Math.abs(dr)===Math.abs(dc) && clear(r1,c1,r2,c2);
        case "q":
            if(r1===r2 || c1===c2) return clear(r1,c1,r2,c2);
            if(Math.abs(dr)===Math.abs(dc)) return clear(r1,c1,r2,c2);
            return false;
        case "n": return (Math.abs(dr)===2 && Math.abs(dc)===1) || (Math.abs(dr)===1 && Math.abs(dc)===2);
        case "k": return Math.abs(dr)<=1 && Math.abs(dc)<=1;
        case "p": return pawnMove(r1,c1,r2,c2,p);
    }
}

function clear(r1,c1,r2,c2){
    let dr = Math.sign(r2-r1), dc = Math.sign(c2-c1);
    let r = r1+dr, c = c1+dc;
    while(r!==r2 || c!==c2){
        if(board[r][c] !== "") return false;
        r+=dr; c+=dc;
    }
    return true;
}

function pawnMove(r1,c1,r2,c2,p){
    const white = isWhite(p);
    const dir = white ? -1 : 1;
    const start = white ? 6 : 1;

    if(c1===c2 && r2===r1+dir && board[r2][c2]==="") return true;
    if(c1===c2 && r1===start && r2===r1+2*dir &&
       board[r1+dir][c1]==="" && board[r2][c2]==="") return true;
    if(Math.abs(c2-c1)===1 && r2===r1+dir && board[r2][c2]!=="" &&
       !sameTeam(p, board[r2][c2])) return true;

    return false;
}

/* ============================================================
   CHECK & CHECKMATE
   ============================================================ */
function findKing(bd,white){
    const k = white ? "K":"k";
    for(let r=0;r<8;r++)
        for(let c=0;c<8;c++)
            if(bd[r][c]===k) return {r,c};
    return null;
}

function isKingChecked(white){
    const king = findKing(board, white);
    if(!king) return false;

    for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
            const p = board[r][c];
            if(!p) continue;

            if(white && isBlack(p)){
                if(validStepTemp(board,r,c,king.r,king.c)) return king;
            }
            if(!white && isWhite(p)){
                if(validStepTemp(board,r,c,king.r,king.c)) return king;
            }
        }
    }
    return false;
}

function validStepTemp(bd,r1,c1,r2,c2){
    const p = bd[r1][c1];
    if(!p) return false;

    const dr=r2-r1, dc=c2-c1;
    const t=p.toLowerCase();

    switch(t){
        case "r": return (r1===r2 || c1===c2) && clearTemp(bd,r1,c1,r2,c2);
        case "b": return Math.abs(dr)===Math.abs(dc) && clearTemp(bd,r1,c1,r2,c2);
        case "q":
            if((r1===r2 || c1===c2) && clearTemp(bd,r1,c1,r2,c2)) return true;
            if(Math.abs(dr)===Math.abs(dc) && clearTemp(bd,r1,c1,r2,c2)) return true;
            return false;
        case "n": return (Math.abs(dr)===2 && Math.abs(dc)===1) || (Math.abs(dr)===1 && Math.abs(dc)===2);
        case "k": return Math.abs(dr)<=1 && Math.abs(dc)<=1;
        case "p":
            const white=isWhite(p);
            const dir = white ? -1 : 1;
            return Math.abs(dc)===1 && r2===r1+dir;
    }
}

function clearTemp(bd,r1,c1,r2,c2){
    let dr=Math.sign(r2-r1), dc=Math.sign(c2-c1);
    let r=r1+dr, c=c1+dc;
    while(r!==r2 || c!==c2){
        if(bd[r][c] !== "") return false;
        r+=dr; c+=dc;
    }
    return true;
}

function kingInCheckAfter(temp,white){
    const king = findKing(temp, white);
    if(!king) return true;

    for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
            const p=temp[r][c];
            if(!p) continue;

            if(white && isBlack(p)){
                if(validStepTemp(temp,r,c,king.r,king.c)) return true;
            }
            if(!white && isWhite(p)){
                if(validStepTemp(temp,r,c,king.r,king.c)) return true;
            }
        }
    }
    return false;
}

function hasMoves(white){
    for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
            const p = board[r][c];
            if(!p) continue;
            if(white && !isWhite(p)) continue;
            if(!white && !isBlack(p)) continue;
            if(getMoves(r,c).length>0) return true;
        }
    }
    return false;
}

function checkCheckmate(){
    const wc = isKingChecked(true);
    const bc = isKingChecked(false);

    const wMove = hasMoves(true);
    const bMove = hasMoves(false);

    if(wc && !wMove){
        alert("Bidak Musik menang! Kamu kalah!");
        stopTimer();
        return true;
    }

    if(bc && !bMove){
        alert("Bidak Tempur menang! Kamu kalah!");
        stopTimer();
        return true;
    }

    return false;
}

/* ============================================================
   PROMOTION
   ============================================================ */
function openPromo(r,c,p){
    const white = isWhite(p);

    document.getElementById("promoQimg").src = "img/" + pieceToFile(white?"Q":"q");
    document.getElementById("promoRimg").src = "img/" + pieceToFile(white?"R":"r");
    document.getElementById("promoBimg").src = "img/" + pieceToFile(white?"B":"b");
    document.getElementById("promoNimg").src = "img/" + pieceToFile(white?"N":"n");

    promoOverlay.style.display = "flex";

    const choose = (piece)=>{
        board[r][c] = white ? piece.toUpperCase() : piece.toLowerCase();
        promoOverlay.style.display = "none";

        turnWhite = !turnWhite;

        drawBoard();
        checkCheckmate();

        if(playingBot && !turnWhite){
            setTimeout(botMove,300);
        }
    };

    document.getElementById("promoQ").onclick = ()=>choose("Q");
    document.getElementById("promoR").onclick = ()=>choose("R");
    document.getElementById("promoB").onclick = ()=>choose("B");
    document.getElementById("promoN").onclick = ()=>choose("N");
}

/* ============================================================
   BOT
   ============================================================ */
function botMove(){
    let allMoves = [];

    for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
            const p = board[r][c];
            if(!p || !isBlack(p)) continue;

            const mv = getMoves(r,c);
            for(let m of mv){
                allMoves.push({r,c,to:m});
            }
        }
    }

    if(allMoves.length===0) return;

    const pick = allMoves[Math.floor(Math.random()*allMoves.length)];

    history.push({ board: clone(board), turnWhite });

    const piece = board[pick.r][pick.c];
    board[pick.to.r][pick.to.c] = piece;
    board[pick.r][pick.c] = "";

    if(piece==="p" && pick.to.r===7){
        openPromo(pick.to.r, pick.to.c, piece);
        return;
    }

    turnWhite = true;
    drawBoard();
    checkCheckmate();
}

/* ============================================================
   BUTTONS
   ============================================================ */
undoBtn.onclick = ()=>{
    if(history.length===0) return;

    const last = history.pop();
    board = clone(last.board);
    turnWhite = last.turnWhite;

    selected=null;
    validMoves=[];

    drawBoard();
};

resetBtn.onclick = ()=>{
    if(!confirm("Reset permainan?")) return;
    board = clone(DEFAULT_BOARD);
    turnWhite = true;
    history = [];
    selected = null;
    validMoves = [];
    drawBoard();
    stopTimer();
    gameSeconds = 0;
    startTimer();
    document.getElementById("timer").textContent = "00:00:00";

    drawBoard();
};

botBtn.onclick = ()=>{
    playingBot = !playingBot;

    if(playingBot){
        botBtn.textContent = "Mode Bot (ON)";
        alert("Mode Bot aktif. Bot main sebagai Bidak Musik.");
    } else {
        botBtn.textContent = "Mode Bot";
        alert("Mode Bot dimatikan.");
    }
};

/* ============================================================
   START
   ============================================================ */
drawBoard();

function startTimer(){
    if(timerInterval) return; // jangan double timer

    timerInterval = setInterval(()=>{
        gameSeconds++;
        document.getElementById("timer").textContent = formatTime(gameSeconds);
    }, 1000);
}

function stopTimer(){
    clearInterval(timerInterval);
    timerInterval = null;
}
