<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO 與分享設定 -->
    <title>楓之谷打寶機率模擬器 | Drop Rate Simulator</title>
    <meta name="description" content="輸入掉落機率與打怪效率，模擬計算獲得寶物所需的擊殺數與時間。包含蒙地卡羅模擬與機率曲線分析。">
    <meta property="og:title" content="楓之谷打寶機率模擬器">
    <meta property="og:description" content="還沒打到寶物嗎？來算算看你是歐洲人還是非洲人。">
    <meta property="og:image" content="https://cdn-icons-png.flaticon.com/512/2720/2720635.png">
    
    <!-- 網站圖示 (Favicon) - 使用 Emoji -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎲</text></svg>">

    <!-- Tailwind CSS (樣式庫) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Chart.js (圖表庫) -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');
        body {
            font-family: 'Noto Sans TC', sans-serif;
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
    </style>
</head>
<body class="bg-slate-100 min-h-screen p-4 md:p-8 text-slate-800">

    <div class="max-w-6xl mx-auto space-y-6">
        
        <!-- Header -->
        <header class="text-center mb-8">
            <div class="inline-block p-3 rounded-full bg-blue-100 mb-4 text-4xl">🎲</div>
            <h1 class="text-3xl md:text-4xl font-bold text-slate-800 mb-2">打寶機率模擬器</h1>
            <p class="text-slate-600">楓之谷 / MMORPG 掉落率視覺化與時間估算工具</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Settings Panel -->
            <div class="lg:col-span-1 space-y-6">
                <div class="glass-panel bg-white rounded-2xl shadow-lg p-6 sticky top-6">
                    <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center border-b pb-2">
                        <svg class="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        參數設定
                    </h2>
                    
                    <div class="space-y-5">
                        <div>
                            <label class="block text-sm font-bold text-slate-700 mb-1">大寶物掉落機率 (1/N)</label>
                            <div class="flex items-center group">
                                <span class="text-slate-400 mr-2 font-mono text-lg">1 /</span>
                                <input type="number" id="rareRateDenominator" value="1000000" class="flex-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2.5 transition" placeholder="例如: 1000000">
                            </div>
                            <p class="text-xs text-slate-500 mt-1">預設：百萬分之一 (0.0001%)</p>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-700 mb-1">基礎掉落物機率 (%)</label>
                            <div class="flex items-center">
                                <input type="number" id="basicDropRate" value="40" class="flex-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2.5" placeholder="例如: 40">
                                <span class="text-slate-500 ml-3 font-bold">%</span>
                            </div>
                        </div>

                         <div>
                            <label class="block text-sm font-bold text-slate-700 mb-1">打寶效率 (掉落物/分鐘)</label>
                            <div class="flex items-center">
                                <input type="number" id="dropsPerMinute" value="60" class="flex-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2.5" placeholder="例如: 60">
                                <span class="text-slate-500 ml-3 text-sm whitespace-nowrap">個 / 分</span>
                            </div>
                            <p class="text-xs text-slate-500 mt-1">預估你每分鐘能撿幾個</p>
                        </div>

                        <button onclick="runSimulation()" class="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition duration-200 flex justify-center items-center mt-4">
                            <svg class="w-5 h-5 mr-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            開始模擬 (Run)
                        </button>
                    </div>

                    <!-- Simulation Stats -->
                    <div id="statsPanel" class="mt-8 pt-6 border-t border-slate-200 hidden animate-fade-in">
                        <h3 class="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
                            模擬結果 
                            <span class="text-xs font-normal bg-slate-100 px-2 py-1 rounded text-slate-500">樣本: 1000人</span>
                        </h3>
                        <div class="space-y-3 text-sm">
                            <div class="p-3 bg-green-50 border border-green-100 rounded-xl hover:shadow-sm transition">
                                <div class="flex justify-between text-green-800 mb-1">
                                    <span class="font-bold">🏆 最幸運 (歐皇)</span>
                                    <span id="statBest" class="font-mono font-bold">--</span>
                                </div>
                                <div id="timeBest" class="text-right text-xs text-green-600 opacity-80">--</div>
                            </div>
                            
                            <div class="p-3 bg-blue-50 border border-blue-100 rounded-xl hover:shadow-sm transition">
                                <div class="flex justify-between text-blue-800 mb-1">
                                    <span class="font-bold">📊 平均值 (期望值)</span>
                                    <span id="statAvg" class="font-mono font-bold">--</span>
                                </div>
                                <div id="timeAvg" class="text-right text-xs text-blue-600 opacity-80">--</div>
                            </div>

                             <div class="p-3 bg-yellow-50 border border-yellow-100 rounded-xl hover:shadow-sm transition">
                                <div class="flex justify-between text-yellow-800 mb-1">
                                    <span class="font-bold">⚖️ 中位數 (50%門檻)</span>
                                    <span id="statMedian" class="font-mono font-bold">--</span>
                                </div>
                                <div id="timeMedian" class="text-right text-xs text-yellow-600 opacity-80">--</div>
                            </div>

                            <div class="p-3 bg-red-50 border border-red-100 rounded-xl hover:shadow-sm transition">
                                <div class="flex justify-between text-red-800 mb-1">
                                    <span class="font-bold">💀 最倒霉 (非酋)</span>
                                    <span id="statWorst" class="font-mono font-bold">--</span>
                                </div>
                                <div id="timeWorst" class="text-right text-xs text-red-600 opacity-80">--</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Panel -->
            <div class="lg:col-span-2 space-y-6">
                
                <!-- Theoretical Curve -->
                <div class="glass-panel bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-bold text-slate-800 mb-2 border-b pb-2">📈 獲得機率曲線 (理論值)</h2>
                    <p class="text-sm text-slate-500 mb-4">隨著你蒐集的掉落物變多，獲得寶物的機率如何提升？</p>
                    <div class="relative h-72 w-full">
                        <canvas id="probChart"></canvas>
                    </div>
                </div>

                <!-- Simulation Histogram -->
                <div class="glass-panel bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-bold text-slate-800 mb-2 border-b pb-2">👥 1000位玩家實測分佈</h2>
                    <p class="text-sm text-slate-500 mb-4">模擬 1000 次從零開始打寶，看看大家都在第幾個掉落物畢業？</p>
                    <div class="relative h-72 w-full">
                        <canvas id="simChart"></canvas>
                    </div>
                </div>
                
                <div class="text-center text-slate-400 text-xs mt-8">
                    <p>此模擬器僅供參考，實際遊戲機率以官方設定為準。</p>
                </div>

            </div>
        </div>
    </div>

    <script>
        let probChartInstance = null;
        let simChartInstance = null;

        // Helper to format numbers (e.g., 1,000,000)
        const fmt = (n) => new Intl.NumberFormat().format(Math.round(n));

        // Helper to format time
        const fmtTime = (minutes) => {
            if (!minutes || minutes < 0 || !isFinite(minutes)) return '未知';
            const days = Math.floor(minutes / 1440);
            const hours = Math.floor((minutes % 1440) / 60);
            const mins = Math.floor(minutes % 60);
            
            let str = '';
            if (days > 0) str += `${days}天 `;
            if (hours > 0) str += `${hours}小時 `;
            if (days === 0 && hours === 0) str += `${mins}分`;
            else if (mins > 0 && days === 0) str += `${mins}分`;
            
            return str.trim() || '小於1分';
        };

        function runSimulation() {
            // 1. Get Inputs
            const rareDenom = parseFloat(document.getElementById('rareRateDenominator').value);
            const basicRatePercent = parseFloat(document.getElementById('basicDropRate').value);
            const dropsPerMin = parseFloat(document.getElementById('dropsPerMinute').value);
            
            if(!rareDenom || !basicRatePercent || rareDenom <= 0 || basicRatePercent <= 0) {
                alert("請輸入有效的機率數值");
                return;
            }

            const rareRate = 1 / rareDenom;
            const basicRate = basicRatePercent / 100;

            // 2. Theoretical Calculations (Curve)
            const killsFor99 = Math.log(0.01) / Math.log(1 - rareRate);
            const maxDropsX = killsFor99 * basicRate * 1.2; 
            const steps = 50;
            const curveLabels = [];
            const curveData = [];

            for (let i = 0; i <= steps; i++) {
                const drops = (maxDropsX / steps) * i;
                const kills = drops / basicRate;
                const prob = 1 - Math.pow(1 - rareRate, kills);
                curveLabels.push(Math.round(drops));
                curveData.push(prob * 100);
            }

            // 3. Monte Carlo Simulation (1000 runs)
            const simCount = 1000;
            const results = [];

            for (let i = 0; i < simCount; i++) {
                const u = Math.random();
                const killsNeeded = Math.ceil(Math.log(1 - u) / Math.log(1 - rareRate));
                const dropsNeeded = Math.round(killsNeeded * basicRate);
                results.push(dropsNeeded);
            }

            results.sort((a, b) => a - b);

            // 4. Calculate Statistics
            const min = results[0];
            const max = results[results.length - 1];
            const median = results[Math.floor(results.length / 2)];
            const sum = results.reduce((a, b) => a + b, 0);
            const avg = sum / results.length;

            // Update Stats UI
            document.getElementById('statsPanel').classList.remove('hidden');
            
            // Update Values
            document.getElementById('statBest').innerText = fmt(min) + " 個";
            document.getElementById('statAvg').innerText = fmt(avg) + " 個";
            document.getElementById('statMedian').innerText = fmt(median) + " 個";
            document.getElementById('statWorst').innerText = fmt(max) + " 個";

            // Update Times
            const updateTime = (id, val) => {
                const el = document.getElementById(id);
                if (dropsPerMin > 0) {
                    el.innerText = `約 ${fmtTime(val / dropsPerMin)}`;
                } else {
                    el.innerText = '';
                }
            };
            
            updateTime('timeBest', min);
            updateTime('timeAvg', avg);
            updateTime('timeMedian', median);
            updateTime('timeWorst', max);

            // 5. Prepare Histogram Data
            const binCount = 30;
            const binSize = (max - min) / binCount;
            const histLabels = [];
            const histData = new Array(binCount).fill(0);

            for (let i = 0; i < binCount; i++) {
                const binStart = min + (i * binSize);
                const binEnd = min + ((i + 1) * binSize);
                histLabels.push(`${fmt(binStart / 1000)}k - ${fmt(binEnd / 1000)}k`);
            }

            results.forEach(val => {
                let binIndex = Math.floor((val - min) / binSize);
                if (binIndex >= binCount) binIndex = binCount - 1;
                histData[binIndex]++;
            });

            // 6. Render Charts
            renderProbChart(curveLabels, curveData);
            renderSimChart(histLabels, histData);
        }

        function renderProbChart(labels, data) {
            const ctx = document.getElementById('probChart').getContext('2d');
            
            if (probChartInstance) probChartInstance.destroy();

            probChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '獲得機率 (%)',
                        data: data,
                        borderColor: 'rgb(37, 99, 235)',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHitRadius: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            title: { display: true, text: '蒐集的掉落物總數' },
                            ticks: {
                                callback: function(value, index, values) {
                                    const label = this.getLabelForValue(value);
                                    if (label > 10000) return (label / 10000).toFixed(1) + '萬';
                                    return label;
                                }
                            }
                        },
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: '#f3f4f6' },
                            title: { display: true, text: '機率 (%)' }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            padding: 12,
                            titleFont: { size: 14 },
                            bodyFont: { size: 14 },
                            callbacks: {
                                label: function(context) {
                                    return `機率: ${context.parsed.y.toFixed(2)}%`;
                                }
                            }
                        }
                    }
                }
            });
        }

        function renderSimChart(labels, data) {
            const ctx = document.getElementById('simChart').getContext('2d');
            
            if (simChartInstance) simChartInstance.destroy();

            simChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '玩家人數',
                        data: data,
                        backgroundColor: function(context) {
                            const index = context.dataIndex;
                            const count = context.dataset.data.length;
                            // Green (Lucky) -> Yellow -> Red (Unlucky)
                            const r = Math.min(255, (index / count) * 255 * 2.5);
                            const g = Math.min(255, 255 - ((index / count) * 255 * 1.2));
                            return `rgba(${r}, ${g}, 100, 0.8)`;
                        },
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            callbacks: {
                                title: (items) => `掉落物區間: ${items[0].label}`,
                                label: (item) => `${item.raw} 位玩家在此區間畢業`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            title: { display: true, text: '打到的掉落物數量區間 (k = 千)' },
                            ticks: {
                                maxTicksLimit: 8,
                                font: { size: 11 }
                            }
                        },
                        y: {
                            grid: { color: '#f3f4f6' },
                            title: { display: true, text: '人數' },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Run default simulation on load
        window.onload = runSimulation;
    </script>
</body>
</html>