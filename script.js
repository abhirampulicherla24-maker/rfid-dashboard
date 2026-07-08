let logs = JSON.parse(localStorage.getItem('rfid_logs')) || [];
let wsAddress = "ws://10.101.0.97:8765"; 
let socket = null;
let socketConnected = false;
let reconnectTimer = null;
let explicitDisconnect = false;

const wsAddressInput = document.getElementById('wsAddressInput');
const btnWsConnect = document.getElementById('btnWsConnect');
const connectionStatusBadge = document.getElementById('connectionStatusBadge');
const connectionStatusText = document.getElementById('connectionStatusText');
const logsTableBody = document.getElementById('logsTableBody');
const logsEmptyState = document.getElementById('logsEmptyState');

document.addEventListener('DOMContentLoaded', () => {
    btnWsConnect.addEventListener('click', toggleWebSocketConnection);
    document.getElementById('btnClearLogs').addEventListener('click', clearLogs);
    wsAddressInput.value = wsAddress;
    renderLogs();
    updateStats();
    connectWebSocket();
    lucide.createIcons();
});

function toggleWebSocketConnection() {
    if (socketConnected) {
        explicitDisconnect = true;
        disconnectWebSocket(); 
    } else { 
        explicitDisconnect = false;
        wsAddress = wsAddressInput.value.trim(); 
        connectWebSocket(); 
    }
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    updateConnectionStatus('connecting');
    try {
        socket = new WebSocket(wsAddress);
        
        socket.onopen = () => {
            socketConnected = true;
            explicitDisconnect = false;
            updateConnectionStatus('connected');
        };
        
        socket.onmessage = (e) => {
            const parts = e.data.trim().split(',');
            if (parts[0] === 'SCAN') {
                logScanEvent(parts[1], parts[2] === 'GRANTED');
            }
        };
        
        socket.onclose = () => {
            socketConnected = false;
            updateConnectionStatus('disconnected');
            if (!explicitDisconnect && !reconnectTimer) {
                reconnectTimer = setTimeout(connectWebSocket, 3000);
            }
        };

        socket.onerror = () => {
            socketConnected = false;
            updateConnectionStatus('disconnected');
        };
    } catch (err) {
        updateConnectionStatus('disconnected');
        if (!explicitDisconnect && !reconnectTimer) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
    }
}

function disconnectWebSocket() {
    if (socket) {
        socket.close();
    }
    socketConnected = false;
    updateConnectionStatus('disconnected');
}

function logScanEvent(uid, isGranted) {
    const standardUid = uid.trim().replace(/\s+/g, ' ');
    logs.unshift({ timestamp: new Date().toLocaleTimeString(), uid: standardUid, status: isGranted ? 'GRANTED' : 'DENIED' });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('rfid_logs', JSON.stringify(logs));
    
    if(isGranted) {
        document.getElementById('gateVisualizer').className = 'gate-visualizer gate-state-open';
        document.getElementById('gateStatusContainer').innerHTML = '<i data-lucide="lock-open"></i><span id="gateStatusText">OPEN</span>';
        lucide.createIcons();

        // Revert to closed state automatically after 3 seconds
        setTimeout(() => {
            document.getElementById('gateVisualizer').className = 'gate-visualizer gate-state-closed';
            document.getElementById('gateStatusContainer').innerHTML = '<i data-lucide="lock" id="gateLockIcon"></i><span id="gateStatusText">CLOSED</span>';
            lucide.createIcons();
        }, 3000);
    } else {
        // If denied, keep gate closed but refresh style states seamlessly
        document.getElementById('gateVisualizer').className = 'gate-visualizer gate-state-closed';
    }

    renderLogs();
    updateStats();
}

function updateConnectionStatus(state) {
    connectionStatusBadge.className = 'status-badge';
    if (state === 'connected') {
        connectionStatusBadge.classList.add('connected');
        connectionStatusText.innerText = 'Connected';
        btnWsConnect.className = 'btn btn-danger';
        btnWsConnect.innerText = 'Disconnect';
    } else if (state === 'connecting') {
        connectionStatusBadge.classList.add('connecting');
        connectionStatusText.innerText = 'Connecting...';
    } else {
        connectionStatusBadge.classList.add('disconnected');
        connectionStatusText.innerText = 'Disconnected';
        btnWsConnect.className = 'btn btn-primary';
        btnWsConnect.innerText = 'Connect';
    }
}

function renderLogs() {
    if (logs.length === 0) { logsEmptyState.style.display = 'block'; logsTableBody.innerHTML = ''; return; }
    logsEmptyState.style.display = 'none';
    logsTableBody.innerHTML = logs.map(l => `<tr><td>${l.timestamp}</td><td class="uid-cell">${l.uid}</td><td><span class="badge ${l.status==='GRANTED'?'badge-success':'badge-danger'}">${l.status}</span></td></tr>`).join('');
}

function updateStats() {
    const total = logs.length;
    const ok = logs.filter(l => l.status === 'GRANTED').length;
    document.getElementById('statTotalEntered').innerText = total;
    document.getElementById('statAccessGranted').innerText = ok;
    document.getElementById('statAccessDenied').innerText = total - ok;
    document.getElementById('statApprovalRate').innerText = total ? Math.round((ok/total)*100) + '%' : '0%';
}

function clearLogs() { logs = []; localStorage.removeItem('rfid_logs'); renderLogs(); updateStats(); }
