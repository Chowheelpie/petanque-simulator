import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Play, RotateCcw, Settings, BarChart3, Target, CircleDot, FileText, Eye, ChevronRight, ChevronDown, User, Cpu, Trophy, Activity, Brain, Calculator } from 'lucide-react';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell, // ⬅️ 一定要加這個
} from 'recharts';

// --- 常數與定義 ---

const STRATEGIES = {
  always_point: { name: '保守型 (只做 Pointing)', desc: '無論局勢如何，總是執行 Pointing。' },
  always_shoot: { name: '攻擊型 (優先 Shooting)', desc: '只要對手場上有球，就嘗試射擊。' },
  conditional_shoot: { name: '規則型 (條件判斷)', desc: '依據對手球的距離與自身失誤次數判斷。' },
  smart_ev_ai: { name: '智能 EV 模型 (AI)', desc: '透過蒙地卡羅模擬計算期望值，選擇最優解 (強化學習行為模擬)。' },
};

// --- 工具函數 ---

const randomNormal = (mean, stdDev) => {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
};

const generateDistributionData = (mean, stdDev) => {
  const data = [];
  for (let x = 0; x <= 150; x += 5) {
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    data.push({ x, probability: y });
  }
  return data;
};

const getProbabilities = (stats) => {
  const pMiss = (100 - stats.hitRate) / 100;
  const pHit = stats.hitRate / 100;
  const pStay = pHit * (stats.stayRate / 100);
  const pClear = pHit - pStay;
  return { 0: pMiss, 1: pClear, 2: pStay };
};

// --- 智能 AI 核心邏輯 (Value-Based) ---

// 1. 評估當前盤面分數 (Heuristic Value Function)
// 正分代表對 team 有利，負分代表對 opponent 有利
const evaluateBoardState = (team, myBalls, oppBalls) => {
    const myBest = myBalls.length > 0 ? Math.min(...myBalls.map(b => b.distance)) : 9999;
    const oppBest = oppBalls.length > 0 ? Math.min(...oppBalls.map(b => b.distance)) : 9999;

    let score = 0;

    if (myBest < oppBest) {
        // 我方贏，計算贏幾分
        const points = myBalls.filter(b => b.distance < oppBest).length;
        // 獎勵分數：基礎分 + 距離優勢 (越近越好)
        score = points * 10 + (100 - Math.min(100, myBest)) * 0.05;
    } else {
        // 對方贏，計算輸幾分 (負分)
        const points = oppBalls.filter(b => b.distance < myBest).length;
        score = -(points * 10 + (100 - Math.min(100, oppBest)) * 0.05);
    }
    return score;
};

// 2. 模擬動作並返回新的狀態 (無副作用)
const simulateActionOutcome = (actionType, team, myBalls, oppBalls, stats, probs) => {
    let newMy = [...myBalls];
    let newOpp = [...oppBalls];
    
    if (actionType === 'point') {
        let distance = Math.abs(randomNormal(stats.pointMean, stats.pointStdDev));
        newMy.push({ distance, team });
    } else {
        const rand = Math.random();
        if (newOpp.length > 0) {
            // 簡化模擬：假設總是打最近的球
            let sortedOpp = [...newOpp].sort((a, b) => a.distance - b.distance);
            const target = sortedOpp[0];
            
            if (rand < probs[0]) {
                // Miss: 沒事發生，但浪費一顆球
            } else if (rand < probs[0] + probs[1]) {
                // Clear: 移除目標
                sortedOpp.shift(); 
                newOpp = sortedOpp;
            } else {
                // Stay: 替換
                sortedOpp.shift();
                const newDist = Math.abs(target.distance + (Math.random() * 60 - 30)); // 簡化位移
                newMy.push({ distance: newDist, team });
                newOpp = sortedOpp;
            }
        } else {
            // 無球可打視為 Pointing
            let distance = Math.abs(randomNormal(stats.pointMean, stats.pointStdDev));
            newMy.push({ distance, team });
        }
    }
    return { myBalls: newMy, oppBalls: newOpp };
};

// 3. 蒙地卡羅決策樹 (Monte Carlo Decision)
const calculateSmartMove = (team, myBalls, oppBalls, stats, probs) => {
    const SIMULATIONS = 30; // 每個動作模擬次數 (越高越準但越慢)
    
    // 模擬 Pointing 的期望值
    let totalPointScore = 0;
    for(let i=0; i<SIMULATIONS; i++) {
        const res = simulateActionOutcome('point', team, myBalls, oppBalls, stats, probs);
        totalPointScore += evaluateBoardState(team, res.myBalls, res.oppBalls);
    }
    const avgPointEV = totalPointScore / SIMULATIONS;

    // 模擬 Shooting 的期望值
    let totalShootScore = 0;
    // 如果對方沒球，射擊期望值極低 (或是無效)
    if (oppBalls.length === 0) {
        totalShootScore = -9999;
    } else {
        for(let i=0; i<SIMULATIONS; i++) {
            const res = simulateActionOutcome('shoot', team, myBalls, oppBalls, stats, probs);
            totalShootScore += evaluateBoardState(team, res.myBalls, res.oppBalls);
        }
    }
    const avgShootEV = oppBalls.length === 0 ? -99 : totalShootScore / SIMULATIONS;

    const action = avgShootEV > avgPointEV ? 'shoot' : 'point';
    
    return {
        action,
        pointEV: avgPointEV,
        shootEV: avgShootEV,
        reason: `Pointing EV: ${avgPointEV.toFixed(2)} | Shooting EV: ${avgShootEV.toFixed(2)}`
    };
};


// --- 視覺化組件 ---

const FieldVisualizer = ({ ballsA, ballsB, title, highlight }) => {
  const allBalls = [...ballsA, ...ballsB];
  const maxDist = Math.max(100, ...allBalls.map(b => b.distance)) + 20;

  return (
    <div className={`p-4 bg-slate-800 rounded-lg shadow-inner overflow-hidden transition-all ${highlight ? 'ring-2 ring-yellow-400' : ''}`}>
      {title && <div className="text-xs text-gray-400 mb-2 text-center uppercase tracking-widest">{title}</div>}
      <div className="flex justify-between text-xs text-gray-500 mb-1 px-1">
        <span>JACK (0cm)</span>
        <span>{Math.round(maxDist)}cm</span>
      </div>
      <div className="relative h-20 border-b-2 border-gray-600 mb-2 bg-slate-800/50">
        <div className="absolute bottom-0 left-0 w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)] z-10 transform -translate-x-1/2 translate-y-1/2" title="Jack"></div>
        {ballsA.map((ball, idx) => (
          <div key={`a-${idx}`} className="absolute bottom-0 w-5 h-5 bg-blue-500 rounded-full border border-blue-200 shadow-md transform -translate-x-1/2 translate-y-1/2 transition-all duration-500 z-20 group" style={{ left: `${Math.min(100, (ball.distance / maxDist) * 100)}%` }}>
             <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-[10px] text-white font-mono bg-blue-900/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{ball.distance.toFixed(0)}</span>
          </div>
        ))}
        {ballsB.map((ball, idx) => (
          <div key={`b-${idx}`} className="absolute bottom-0 w-5 h-5 bg-red-600 rounded-full border border-red-200 shadow-md transform -translate-x-1/2 translate-y-1/2 transition-all duration-500 z-20 group" style={{ left: `${Math.min(100, (ball.distance / maxDist) * 100)}%` }}>
             <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-[10px] text-white font-mono bg-red-900/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{ball.distance.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const NumberSlider = ({ label, value, onChange, min = 0, max = 100, suffix = '' }) => (
  <div className="mb-3">
    <div className="flex justify-between items-center text-sm mb-1">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" min={min} max={max} value={value} onChange={(e) => { let val = parseFloat(e.target.value); if (isNaN(val)) val = min; if (val < min) val = min; if (val > max) val = max; onChange(val); }} className="w-16 p-1 text-right text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-blue-900" />
        <span className="text-gray-400 w-4">{suffix}</span>
      </div>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
  </div>
);

// --- AI 思維視覺化組件 ---
const AIReasoningPanel = ({ reasoning }) => {
  if (!reasoning) return null;
  const { pointEV, shootEV, action } = reasoning;
  
  // Normalize for display: find max amplitude
  const maxVal = Math.max(Math.abs(pointEV), Math.abs(shootEV), 10);
  const pointPercent = (pointEV / maxVal) * 100;
  const shootPercent = (shootEV / maxVal) * 100;

  return (
    <div className="mt-2 bg-slate-900 rounded-lg p-3 border border-slate-700 shadow-lg animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-400 uppercase tracking-widest">
         <Brain size={14} /> AI 戰術思維分析 (期望值計算)
      </div>
      
      <div className="flex gap-4 items-end h-24 mb-2 border-b border-slate-700 pb-2">
        <div className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-xs text-gray-400 font-mono">{pointEV.toFixed(1)}</span>
            <div 
                className={`w-full rounded-t transition-all duration-500 ${action === 'point' ? 'bg-blue-500 opacity-100' : 'bg-blue-900 opacity-50'}`}
                style={{ height: `${Math.max(5, Math.abs(pointPercent))}%` }}
            ></div>
            <span className="text-[10px] text-gray-400">Pointing EV</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-xs text-gray-400 font-mono">{shootEV.toFixed(1)}</span>
            <div 
                className={`w-full rounded-t transition-all duration-500 ${action === 'shoot' ? 'bg-red-500 opacity-100' : 'bg-red-900 opacity-50'}`}
                style={{ height: `${Math.max(5, Math.abs(shootPercent))}%` }}
            ></div>
            <span className="text-[10px] text-gray-400">Shooting EV</span>
        </div>
      </div>
      
      <div className="text-xs text-gray-300 leading-relaxed">
         <span className="text-purple-400 font-bold">決策：</span> 
         AI 判斷 {action === 'point' ? 'Pointing (佈球)' : 'Shooting (射擊)'} 能帶來更高的局面分數期望值 (Δ = {Math.abs(pointEV - shootEV).toFixed(2)})。
      </div>
    </div>
  );
};

// --- 主要組件 ---

const PetanqueSimulator = () => {
  // --- 狀態管理 ---

  const [appMode, setAppMode] = useState('interactive'); // Default to interactive for this update

  const [teamAStats, setTeamAStats] = useState({
    pointMean: 50, pointStdDev: 20, hitRate: 60, stayRate: 20,
    strategy: 'always_point', shootThreshold: 50, maxMisses: 2,
  });

  const [teamBStats, setTeamBStats] = useState({
    pointMean: 50, pointStdDev: 20, hitRate: 60, stayRate: 20,
    strategy: 'smart_ev_ai', // Default B to Smart AI
    shootThreshold: 50, maxMisses: 2,
  });

  // Simulation State
  const [simCount, setSimCount] = useState(1000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [singleMatchLog, setSingleMatchLog] = useState(null);

  // Interactive Game State
  const [gameState, setGameState] = useState({
    status: 'idle',
    score: { A: 0, B: 0 },
    round: 0,
    balls: { A: 6, B: 6 },
    onField: { A: [], B: [] },
    missesInRound: { A: 0, B: 0 },
    currentTurn: null,
    lastWinner: null,
    logs: [],
    aiThinking: false,
    currentAIReasoning: null, // Store latest AI thought
  });

  const logsEndRef = useRef(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [gameState.logs]);

  // --- Core Logic ---

  const executeAction = (actionType, team, currentBalls, opponentBalls, stats, probs) => {
    let newBalls = [...currentBalls];
    let newOpponentBalls = [...opponentBalls];
    let outcomeType = -1; 
    let logDesc = "";

    if (actionType === 'point') {
      let distance = Math.abs(randomNormal(stats.pointMean, stats.pointStdDev));
      newBalls.push({ type: 'point', distance: distance, team: team });
      logDesc = `執行 Pointing，落點距離 ${distance.toFixed(1)}cm`;
    } else {
      const rand = Math.random();
      if (newOpponentBalls.length > 0) {
        newOpponentBalls.sort((a, b) => a.distance - b.distance);
        const targetBall = newOpponentBalls[0]; 
        if (rand < probs[0]) {
          outcomeType = 0; logDesc = `執行 Shooting 失誤 (未擊中)`;
        } else if (rand < probs[0] + probs[1]) {
          outcomeType = 1; newOpponentBalls.shift();
          logDesc = `執行 Shooting 成功 (擊飛 ${targetBall.distance.toFixed(1)}cm 處的球)`;
        } else {
          outcomeType = 2; 
          const originalDist = targetBall.distance;
          newOpponentBalls.shift();
          const displacement = (Math.random() * 200) - 100; 
          const newDist = Math.abs(originalDist + displacement);
          newBalls.push({ type: 'shoot_stay', distance: newDist, team: team });
          logDesc = `執行 Shooting 完美 (Carreau! 停在 ${newDist.toFixed(1)}cm)`;
        }
      } else {
        let distance = Math.abs(randomNormal(stats.pointMean, stats.pointStdDev));
        newBalls.push({ type: 'point', distance: distance, team: team });
        logDesc = `場上無球被迫改為 Pointing (落點 ${distance.toFixed(1)}cm)`;
      }
    }
    return { myBalls: newBalls, oppBalls: newOpponentBalls, outcome: outcomeType, log: logDesc };
  };

  const decideActionWrapper = (team, myBalls, oppBalls, stats, probs, missesInRound) => {
    const strategy = stats.strategy;
    
    // Special handling for Smart AI
    if (strategy === 'smart_ev_ai') {
        const decision = calculateSmartMove(team, myBalls, oppBalls, stats, probs);
        return { action: decision.action, reasoning: decision };
    }

    if (oppBalls.length === 0) return { action: 'point', reasoning: null };
    if (strategy === 'always_point') return { action: 'point', reasoning: null };
    if (strategy === 'always_shoot') return { action: 'shoot', reasoning: null };
    if (strategy === 'conditional_shoot') {
      const bestOpp = Math.min(...oppBalls.map(b => b.distance));
      if (bestOpp < stats.shootThreshold && missesInRound < stats.maxMisses) {
        return { action: 'shoot', reasoning: null };
      }
      return { action: 'point', reasoning: null };
    }
    return { action: 'point', reasoning: null };
  };

  const getNextThrower = (ballsA, ballsB, onFieldA, onFieldB, lastThrower) => {
    if (ballsA === 0 && ballsB === 0) return null;
    if (ballsA === 0) return 'B';
    if (ballsB === 0) return 'A';
    const bestA = onFieldA.length > 0 ? Math.min(...onFieldA.map(b => b.distance)) : Infinity;
    const bestB = onFieldB.length > 0 ? Math.min(...onFieldB.map(b => b.distance)) : Infinity;
    if (bestA < bestB) return 'B';
    if (bestB < bestA) return 'A';
    return lastThrower || 'A';
  };

  // --- Interactive Game Logic ---

  const startInteractiveGame = () => {
    setGameState({
      status: 'playing', score: { A: 0, B: 0 }, round: 1,
      balls: { A: 6, B: 6 }, onField: { A: [], B: [] }, missesInRound: { A: 0, B: 0 },
      currentTurn: Math.random() < 0.5 ? 'A' : 'B', lastWinner: null,
      logs: [{ round: 1, text: '比賽開始！第一局由隨機決定先手。' }], aiThinking: false, currentAIReasoning: null
    });
  };

  const startNextRound = () => {
    const nextStarter = gameState.score.A > gameState.score.B ? 'A' : (gameState.score.B > gameState.score.A ? 'B' : (gameState.lastWinner || 'A'));
    setGameState(prev => ({
      ...prev, status: 'playing', round: prev.round + 1,
      balls: { A: 6, B: 6 }, onField: { A: [], B: [] }, missesInRound: { A: 0, B: 0 },
      currentTurn: prev.lastWinner || nextStarter, aiThinking: false, currentAIReasoning: null,
      logs: [...prev.logs, { round: prev.round + 1, text: `----- 第 ${prev.round + 1} 局開始 -----` }],
    }));
  };

  useEffect(() => {
    if (gameState.status === 'playing' && gameState.currentTurn === 'B' && !gameState.aiThinking) {
      setGameState(prev => ({ ...prev, aiThinking: true, currentAIReasoning: null }));
      
      // Simulate "Thinking Time"
      setTimeout(() => {
        const probs = getProbabilities(teamBStats);
        const decision = decideActionWrapper('B', gameState.onField.B, gameState.onField.A, teamBStats, probs, gameState.missesInRound.B);
        
        // Set reasoning first so UI can update if needed, then execute
        if (decision.reasoning) {
             setGameState(prev => ({ ...prev, currentAIReasoning: decision.reasoning }));
             // Small delay to let user see reasoning if we wanted, but for flow we just execute
        }
        handleTurn('B', decision.action, decision.reasoning);
      }, 1000);
    }
  }, [gameState.status, gameState.currentTurn, gameState.aiThinking]);

  const handleTurn = (team, actionType, reasoning = null) => {
    const isA = team === 'A';
    const stats = isA ? teamAStats : teamBStats;
    const probs = getProbabilities(stats);
    const myField = isA ? gameState.onField.A : gameState.onField.B;
    const oppField = isA ? gameState.onField.B : gameState.onField.A;

    const res = executeAction(actionType, team, myField, oppField, stats, probs);

    setGameState(prev => {
      const newOnField = { ...prev.onField };
      if (isA) { newOnField.A = res.myBalls; newOnField.B = res.oppBalls; } 
      else { newOnField.B = res.myBalls; newOnField.A = res.oppBalls; }

      const newBalls = { ...prev.balls }; newBalls[team] -= 1;
      const newMisses = { ...prev.missesInRound };
      if (actionType === 'shoot' && res.outcome === 0) newMisses[team] += 1;

      const logEntry = { team, action: actionType, text: res.log, round: prev.round, reasoning };
      const nextTurn = getNextThrower(newBalls.A, newBalls.B, newOnField.A, newOnField.B, team);

      let nextStatus = 'playing';
      let nextScore = { ...prev.score };
      let roundWinner = null;
      let roundPoints = 0;
      let nextLastWinner = prev.lastWinner;

      if (!nextTurn) {
        nextStatus = 'round_end';
        const bestA = newOnField.A.length > 0 ? Math.min(...newOnField.A.map(b => b.distance)) : Infinity;
        const bestB = newOnField.B.length > 0 ? Math.min(...newOnField.B.map(b => b.distance)) : Infinity;

        if (bestA < bestB) {
            roundWinner = 'A'; nextLastWinner = 'A';
            const cutoff = bestB;
            roundPoints = newOnField.A.filter(b => b.distance < cutoff).length;
            nextScore.A = Math.min(13, nextScore.A + roundPoints);
        } else {
            roundWinner = 'B'; nextLastWinner = 'B';
            const cutoff = bestA;
            roundPoints = newOnField.B.filter(b => b.distance < cutoff).length;
            nextScore.B = Math.min(13, nextScore.B + roundPoints);
        }
        if (nextScore.A >= 13 || nextScore.B >= 13) nextStatus = 'game_end';
      }

      const finalLogs = [...prev.logs, logEntry];
      if (nextStatus === 'round_end' || nextStatus === 'game_end') {
          finalLogs.push({ text: `局結束！${roundWinner === 'A' ? 'A隊' : 'B隊'} 獲得 ${roundPoints} 分。`, highlight: true });
          if (nextStatus === 'game_end') {
              finalLogs.push({ text: `比賽結束！${nextScore.A >= 13 ? 'A隊' : 'B隊'} 獲勝 (比分 ${nextScore.A}:${nextScore.B})`, highlight: true, gameOver: true });
          }
      }

      return {
        ...prev, status: nextStatus, balls: newBalls, onField: newOnField, missesInRound: newMisses,
        currentTurn: nextTurn, score: nextScore, lastWinner: nextLastWinner, logs: finalLogs, aiThinking: false,
        currentAIReasoning: reasoning || prev.currentAIReasoning // Keep reasoning visible
      };
    });
  };

  // --- Batch Simulation ---

  const simulateMatch = useCallback((logging = false) => {
    let scoreA = 0, scoreB = 0, round = 0, matchLogs = [];
    let lastWinner = Math.random() < 0.5 ? 'A' : 'B';
    const probsA = getProbabilities(teamAStats);
    const probsB = getProbabilities(teamBStats);

    while (scoreA < 13 && scoreB < 13) {
      round++;
      let roundLog = { roundNum: round, startScoreA: scoreA, startScoreB: scoreB, actions: [], finalState: null };
      let ballsA = 6, ballsB = 6;
      let onFieldA = [], onFieldB = [];
      let missesA = 0, missesB = 0;
      let currentTurn = lastWinner;

      // First ball
      if (currentTurn === 'A') {
        const res = executeAction('point', 'A', onFieldA, onFieldB, teamAStats, probsA);
        onFieldA = res.myBalls; ballsA--;
        if(logging) roundLog.actions.push({ team: 'A', type: 'point', desc: res.log });
        currentTurn = 'B';
      } else {
        const res = executeAction('point', 'B', onFieldB, onFieldA, teamBStats, probsB);
        onFieldB = res.myBalls; ballsB--;
        if(logging) roundLog.actions.push({ team: 'B', type: 'point', desc: res.log });
        currentTurn = 'A';
      }

      while (ballsA > 0 || ballsB > 0) {
        let bestA = onFieldA.length > 0 ? Math.min(...onFieldA.map(b => b.distance)) : Infinity;
        let bestB = onFieldB.length > 0 ? Math.min(...onFieldB.map(b => b.distance)) : Infinity;
        let nextThrower = '';
        if (ballsA === 0) nextThrower = 'B';
        else if (ballsB === 0) nextThrower = 'A';
        else {
          if (bestA < bestB) nextThrower = 'B'; else nextThrower = 'A';
        }

        if (nextThrower === 'A') {
            const dec = decideActionWrapper('A', onFieldA, onFieldB, teamAStats, probsA, missesA);
            const res = executeAction(dec.action, 'A', onFieldA, onFieldB, teamAStats, probsA);
            onFieldA = res.myBalls; onFieldB = res.oppBalls; ballsA--;
            if (dec.action === 'shoot' && res.outcome === 0) missesA++;
            if(logging) roundLog.actions.push({ team: 'A', type: dec.action, desc: res.log });
        } else {
            const dec = decideActionWrapper('B', onFieldB, onFieldA, teamBStats, probsB, missesB);
            const res = executeAction(dec.action, 'B', onFieldB, onFieldA, teamBStats, probsB);
            onFieldB = res.myBalls; onFieldA = res.oppBalls; ballsB--;
            if (dec.action === 'shoot' && res.outcome === 0) missesB++;
            if(logging) roundLog.actions.push({ team: 'B', type: dec.action, desc: res.log });
        }
      }

      let roundScoreA = 0, roundScoreB = 0;
      let finalBestA = onFieldA.length > 0 ? Math.min(...onFieldA.map(b => b.distance)) : Infinity;
      let finalBestB = onFieldB.length > 0 ? Math.min(...onFieldB.map(b => b.distance)) : Infinity;
      let roundWinner = '';

      if (finalBestA < finalBestB) {
        lastWinner = 'A'; roundWinner = 'A';
        const cutoff = finalBestB; roundScoreA = onFieldA.filter(b => b.distance < cutoff).length;
      } else {
        lastWinner = 'B'; roundWinner = 'B';
        const cutoff = finalBestA; roundScoreB = onFieldB.filter(b => b.distance < cutoff).length;
      }

      if (roundScoreA > 0) scoreA = Math.min(13, scoreA + roundScoreA);
      else scoreB = Math.min(13, scoreB + roundScoreB);

      if(logging) {
          roundLog.finalState = { ballsA: onFieldA, ballsB: onFieldB, winner: roundWinner, points: roundScoreA || roundScoreB };
          roundLog.endScoreA = scoreA; roundLog.endScoreB = scoreB;
          matchLogs.push(roundLog);
      }
    }
    return { scoreA, scoreB, winner: scoreA === 13 ? 'A' : 'B', logs: matchLogs };
  }, [teamAStats, teamBStats]);

  const runBatchSimulation = () => {
    setIsSimulating(true); setResults(null); setProgress(0);
    setTimeout(() => {
      const newResults = { totalMatches: simCount, teamAWins: 0, teamBWins: 0, scoreDistribution: Array(27).fill(0).map((_, i) => ({ scoreGap: i - 13, count: 0, label: '' })) };
      
      // 動態調整 batchSize：如果有 AI 策略，批次要小以免凍結介面；如果是普通策略，批次要大以加速運算
      const hasAI = teamAStats.strategy === 'smart_ev_ai' || teamBStats.strategy === 'smart_ev_ai';
      const batchSize = hasAI ? 10 : 500; 

      let current = 0;
      const runBatch = () => {
        for (let i = 0; i < batchSize && current < simCount; i++) {
          const match = simulateMatch(false);
          current++;
          if (match.winner === 'A') {
            newResults.teamAWins++;
            const index = 13 + (13 - match.scoreB); 
            if (newResults.scoreDistribution[index]) { newResults.scoreDistribution[index].count++; newResults.scoreDistribution[index].label = `A 13:${match.scoreB}`; }
          } else {
            newResults.teamBWins++;
            const index = 13 + (match.scoreA - 13);
            if (newResults.scoreDistribution[index]) { newResults.scoreDistribution[index].count++; newResults.scoreDistribution[index].label = `B 13:${match.scoreA}`; }
          }
        }
        setProgress(Math.floor((current / simCount) * 100));
        if (current < simCount) setTimeout(runBatch, 0);
        else {
          newResults.scoreDistribution = newResults.scoreDistribution.filter(d => d.label !== '');
          setResults(newResults); setIsSimulating(false);
        }
      };
      runBatch();
    }, 50);
  };

  // --- UI Renders ---

  const distDataA = useMemo(() => generateDistributionData(teamAStats.pointMean, teamAStats.pointStdDev), [teamAStats]);
  const distDataB = useMemo(() => generateDistributionData(teamBStats.pointMean, teamBStats.pointStdDev), [teamBStats]);

  const TeamConfigPanel = ({ teamName, color, stats, setStats, distData }) => {
    const isA = teamName === 'A';
    const themeColor = isA ? 'text-blue-700' : 'text-red-600';
    const strokeColor = isA ? '#2563eb' : '#dc2626';
    const probs = getProbabilities(stats);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className={`text-xl font-bold ${themeColor} mb-4 flex items-center gap-2 border-b pb-2`}>
          <Target size={20}/> {teamName} 隊 {stats.strategy === 'smart_ev_ai' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Smart AI</span>}
        </h2>
        
        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pointing (佈球)</h3>
          <div className="h-16 w-full mb-2 bg-gray-50 rounded-lg p-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={distData}>
                <Line type="monotone" dataKey="probability" stroke={strokeColor} dot={false} strokeWidth={2} />
                <XAxis dataKey="x" hide />
                <YAxis hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <NumberSlider label="平均距離" value={stats.pointMean} min={0} max={150} suffix="cm" onChange={(v) => setStats({...stats, pointMean: v})} />
          <NumberSlider label="標準差" value={stats.pointStdDev} min={5} max={60} suffix="cm" onChange={(v) => setStats({...stats, pointStdDev: v})} />
        </div>

        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Shooting (射擊)</h3>
          <NumberSlider label="命中率" value={stats.hitRate} max={100} suffix="%" onChange={(v) => setStats({...stats, hitRate: v})} />
          <NumberSlider label="Carreau率" value={stats.stayRate} max={100} suffix="%" onChange={(v) => setStats({...stats, stayRate: v})} />
          <div className="text-xs text-gray-500 flex justify-between px-2 mt-2 bg-slate-50 p-2 rounded border border-gray-100">
            <span title="完全沒打中">Miss (失誤): <span className="font-mono font-bold">{(probs[0]*100).toFixed(0)}%</span></span>
            <span title="打中且球滾走">Clear (擊飛): <span className="font-mono font-bold">{(probs[1]*100).toFixed(0)}%</span></span>
            <span title="打中且球留在原地或微幅位移">Stay (定桿): <span className="font-mono font-bold">{(probs[2]*100).toFixed(0)}%</span></span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${isA ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
          <span className={`text-xs font-bold ${isA ? 'text-blue-600' : 'text-red-600'} uppercase block mb-2`}>
            {isA ? "A 隊策略" : "B 隊策略 (電腦)"}
          </span>
          <select className="w-full p-2 text-sm border-gray-300 rounded mb-2 bg-white" value={stats.strategy} onChange={(e) => setStats({...stats, strategy: e.target.value})}>
            {Object.entries(STRATEGIES).map(([key, val]) => (<option key={key} value={key}>{val.name}</option>))}
          </select>
          <p className="text-[10px] text-gray-500 mb-2 leading-tight">{STRATEGIES[stats.strategy].desc}</p>
          
          {stats.strategy === 'conditional_shoot' && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <NumberSlider label="觸發距離" value={stats.shootThreshold} min={10} max={100} suffix="cm" onChange={(v) => setStats({...stats, shootThreshold: v})} />
              <NumberSlider label="容忍失誤" value={stats.maxMisses} min={0} max={6} suffix="次" onChange={(v) => setStats({...stats, maxMisses: v})} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <CircleDot className="text-blue-600 w-8 h-8" />
            法式滾球戰術模擬器 <span className="text-sm font-normal text-white bg-gradient-to-r from-purple-500 to-blue-500 px-2 py-1 rounded-md flex items-center gap-1"><Brain size={12}/> AI 實驗室版</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            選擇「智能 EV 模型」策略，透過蒙地卡羅模擬預測最佳行動，並即時觀察 AI 的決策期望值分析。
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-3 space-y-6"><TeamConfigPanel teamName="A" color="blue" stats={teamAStats} setStats={setTeamAStats} distData={distDataA} /></div>
          <div className="lg:col-span-3 space-y-6 lg:order-3"><TeamConfigPanel teamName="B" color="red" stats={teamBStats} setStats={setTeamBStats} distData={distDataB} /></div>

          <div className="lg:col-span-6 lg:order-2 space-y-4">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
              <button onClick={() => setAppMode('setup')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${appMode === 'setup' ? 'bg-slate-100 text-slate-800 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
                <BarChart3 size={16}/> 大數據模擬
              </button>
              <button onClick={() => setAppMode('interactive')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${appMode === 'interactive' ? 'bg-blue-50 text-blue-700 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
                <User size={16}/> 人機對戰實測
              </button>
            </div>

            {appMode === 'setup' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2">
                        <select value={simCount} onChange={(e) => setSimCount(Number(e.target.value))} className="flex-1 p-2 border border-gray-300 rounded-md text-sm" disabled={isSimulating}>
                        <option value="100">100 場</option> <option value="500">500 場</option> <option value="1000">1,000 場</option>
                        <option value="5000">5,000 場</option> <option value="10000">10,000 場</option>
                        </select>
                        <button onClick={runBatchSimulation} disabled={isSimulating} className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-bold text-white text-sm transition-all ${isSimulating ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                        {isSimulating ? <RotateCcw size={16} className="animate-spin" /> : <Play size={16} />} {isSimulating ? `${progress}%` : '開始分析'}
                        </button>
                    </div>
                    {teamBStats.strategy === 'smart_ev_ai' && <div className="mt-2 text-[10px] text-purple-600 flex items-center gap-1"><Brain size={10}/> 使用智能 AI 模擬速度較慢，建議場次從少量開始。</div>}
                </div>
                {results && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-center w-1/2 border-r border-gray-100"><div className="text-3xl font-extrabold text-blue-600">{((results.teamAWins / results.totalMatches) * 100).toFixed(1)}%</div><div className="text-xs text-gray-500 font-bold">A 隊勝率</div></div>
                        <div className="text-center w-1/2"><div className="text-3xl font-extrabold text-red-600">{((results.teamBWins / results.totalMatches) * 100).toFixed(1)}%</div><div className="text-xs text-gray-500 font-bold">B 隊勝率</div></div>
                    </div>
                    <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.scoreDistribution} margin={{top:5, right:5, bottom:5, left:-20}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" hide />
                        <YAxis tick={{fontSize: 10}} />
                        <RechartsTooltip labelFormatter={(l)=>l} formatter={(v)=>[v,'場']} contentStyle={{fontSize:'12px'}} />
                        <ReferenceLine x="A 13:12" stroke="#ccc" />
                        <Bar dataKey="count">
                            {results.scoreDistribution.map((e, i) => (<Cell key={`c-${i}`} fill={e.scoreGap > 0 ? '#3b82f6' : '#ef4444'} />))}
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>
                )}
              </div>
            )}

            {appMode === 'interactive' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {gameState.status === 'idle' ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><User className="text-blue-600" size={32} /></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">人機對戰模式</h3>
                    <p className="text-gray-500 mb-6 text-sm">建議將 B 隊策略設定為 <span className="text-purple-600 font-bold">智能 EV 模型</span>，即可在下方日誌中觀察 AI 每一手的思考過程。</p>
                    <button onClick={startInteractiveGame} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition-all flex items-center gap-2 mx-auto"><Play size={20}/> 開始比賽</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                      <div className="flex flex-col items-center w-20"><span className="text-xs text-blue-400 font-bold">YOU (A)</span><span className="text-4xl font-mono font-bold">{gameState.score.A}</span></div>
                      <div className="flex flex-col items-center">
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">ROUND {gameState.round}</div>
                        <div className="text-xs bg-slate-800 px-2 py-1 rounded">{gameState.status === 'game_end' ? 'GAME OVER' : gameState.status === 'round_end' ? '局結束' : gameState.currentTurn === 'A' ? '你的回合' : '電腦思考中...'}</div>
                      </div>
                      <div className="flex flex-col items-center w-20"><span className="text-xs text-red-400 font-bold">CPU (B)</span><span className="text-4xl font-mono font-bold">{gameState.score.B}</span></div>
                    </div>

                    {/* 新增：球數顯示區塊 */}
                    <div className="flex justify-between items-center px-4 py-2 bg-white border-b border-gray-200">
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">A 隊球數 ({gameState.balls.A})</span>
                            <div className="flex gap-1">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < gameState.balls.A ? 'bg-blue-500 shadow-sm scale-100' : 'bg-gray-100 border border-gray-200 scale-90'}`}></div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">B 隊球數 ({gameState.balls.B})</span>
                             <div className="flex gap-1">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < gameState.balls.B ? 'bg-red-600 shadow-sm scale-100' : 'bg-gray-100 border border-gray-200 scale-90'}`}></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-100"><FieldVisualizer ballsA={gameState.onField.A} ballsB={gameState.onField.B} highlight={gameState.currentTurn === 'A'} /></div>

                    {/* AI Reasoning Display */}
                    {gameState.currentAIReasoning && teamBStats.strategy === 'smart_ev_ai' && (
                        <div className="px-4 pb-2 bg-slate-100">
                            <AIReasoningPanel reasoning={gameState.currentAIReasoning} />
                        </div>
                    )}

                    <div className="p-4 border-t border-gray-100 min-h-[80px] flex items-center justify-center">
                        {gameState.status === 'playing' && gameState.currentTurn === 'A' && (
                            <div className="flex gap-3 w-full">
                                <button onClick={() => handleTurn('A', 'point')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md flex flex-col items-center justify-center gap-1"><div className="flex items-center gap-1"><Target size={16}/> Pointing</div></button>
                                <button onClick={() => handleTurn('A', 'shoot')} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold shadow-md flex flex-col items-center justify-center gap-1"><div className="flex items-center gap-1"><Activity size={16}/> Shooting</div></button>
                            </div>
                        )}
                        {gameState.status === 'playing' && gameState.currentTurn === 'B' && <div className="text-gray-500 flex items-center gap-2"><Cpu className="animate-pulse" size={20}/> 電腦正在思考策略...</div>}
                        {gameState.status === 'round_end' && <button onClick={startNextRound} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-black flex items-center gap-2"><ChevronRight/> 下一局</button>}
                        {gameState.status === 'game_end' && <div className="text-center"><div className="text-xl font-bold mb-2 text-slate-800">{gameState.score.A > gameState.score.B ? '🏆 恭喜獲勝！' : '💀 惜敗！再接再厲'}</div><button onClick={startInteractiveGame} className="text-blue-600 font-bold hover:underline text-sm">再玩一場</button></div>}
                    </div>

                    <div className="bg-slate-50 border-t border-gray-200 h-48 overflow-y-auto p-3 text-sm font-mono">
                        {gameState.logs.map((log, idx) => (
                            <div key={idx} className={`mb-1 ${log.highlight ? 'font-bold py-1 border-t border-b border-gray-200 my-2 bg-white' : ''} ${log.gameOver ? 'text-lg text-center text-blue-600 py-4' : ''}`}>
                                {log.round && !log.action && !log.highlight && <span className="text-gray-400 mr-2">[R{log.round}]</span>}
                                {log.action && <span className={`font-bold mr-2 ${log.team === 'A' ? 'text-blue-600' : 'text-red-600'}`}>{log.team === 'A' ? 'YOU' : 'CPU'}:</span>}
                                <span className="text-slate-700">{log.text}</span>
                                {log.reasoning && <div className="text-[10px] text-purple-600 ml-10 italic border-l-2 border-purple-200 pl-2 mt-1">↳ AI思考: {log.reasoning.reason}</div>}
                                {idx === gameState.logs.length - 1 && <div ref={logsEndRef} />}
                            </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetanqueSimulator;