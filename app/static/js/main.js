// app/static/js/main.js - COMPLETE FIXED VERSION WITH BACKUP CODE

// State
let currentFilter = 'all';
let currentType = 'all';
let currentTasks = [];
let userLocation = null;
let selectedTaskId = null;
let currentView = 'feed';
let pendingWhatsAppLink = null;
let locationConsentGiven = false;
let currentTaskData = null;
let toastTimeout = null;
let notificationCheckInterval = null;
let lastNotificationCount = 0;
let currentBackupCode = null;  // Store backup code globally

// DOM Elements
let tasksGrid, searchInput, tasksCount, postModal, taskModal, confirmModal, candidatesModal, notificationsPanel, toastEl, locationBanner;

// ============ HIDE LOADING SCREEN ============
function hideLoadingScreen() {
    console.log('Hiding loading screen...');
    const loadingScreen = document.getElementById('loadingScreen');
    const appContent = document.getElementById('appContent');
    
    if (loadingScreen) {
        loadingScreen.style.transition = 'opacity 0.5s';
        loadingScreen.style.opacity = '0';
        setTimeout(function() {
            loadingScreen.style.display = 'none';
            if (appContent) {
                appContent.style.display = 'block';
                console.log('App content revealed - ready to use');
            }
        }, 500);
    } else {
        console.log('Loading screen not found, showing app directly');
        if (appContent) appContent.style.display = 'block';
    }
}

// ============ INITIALIZE DOM ELEMENTS ============
function initDOMElements() {
    tasksGrid = document.getElementById('tasksGrid');
    searchInput = document.getElementById('searchInput');
    tasksCount = document.getElementById('tasksCount');
    postModal = document.getElementById('postModal');
    taskModal = document.getElementById('taskModal');
    confirmModal = document.getElementById('confirmModal');
    candidatesModal = document.getElementById('candidatesModal');
    notificationsPanel = document.getElementById('notificationsPanel');
    toastEl = document.getElementById('toast');
    locationBanner = document.getElementById('locationBanner');
    
    console.log('DOM Elements check:', {
        tasksGrid: !!tasksGrid,
        toastEl: !!toastEl,
        appContent: !!document.getElementById('appContent')
    });
}

// ============ TOAST FUNCTION ============
function showToast(message, type = 'success') {
    if (!toastEl) {
        console.log('Toast element not ready yet');
        return;
    }
    
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toastEl.querySelector('i');
    
    if (!toastMessage) return;
    
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    
    toastEl.classList.remove('show');
    
    setTimeout(function() {
        toastMessage.textContent = message;
        
        if (type === 'error') {
            toastEl.style.background = '#EF4444';
            if (toastIcon) toastIcon.className = 'fas fa-exclamation-circle';
        } else if (type === 'info') {
            toastEl.style.background = '#3B82F6';
            if (toastIcon) toastIcon.className = 'fas fa-info-circle';
        } else {
            toastEl.style.background = '#22C55E';
            if (toastIcon) toastIcon.className = 'fas fa-check-circle';
        }
        
        toastEl.classList.add('show');
        
        toastTimeout = setTimeout(function() {
            toastEl.classList.remove('show');
            toastTimeout = null;
        }, 3000);
    }, 50);
}

// ============ LOCATION FUNCTIONS ============
async function checkExistingLocation() {
    try {
        const response = await axios.get('/api/location-status');
        if (response.data.has_location && response.data.consent_given) {
            userLocation = {
                lat: response.data.latitude,
                lon: response.data.longitude
            };
            locationConsentGiven = true;
            updateProfileLocationUI(true, userLocation.lat, userLocation.lon);
            hideLocationBanner();
        } else {
            updateProfileLocationUI(false);
        }
    } catch (error) {
        console.error('Error checking location:', error);
        updateProfileLocationUI(false);
    }
}

function updateProfileLocationUI(isActive, lat, lon) {
    const dot = document.getElementById('locationDotStatus');
    const statusText = document.getElementById('locationStatusText');
    const coordsDiv = document.getElementById('locationCoords');
    const coordDisplay = document.getElementById('coordDisplay');
    const enableBtn = document.getElementById('enableLocationProfileBtn');
    
    if (dot) {
        dot.className = isActive ? 'location-dot-status online' : 'location-dot-status offline';
    }
    if (statusText) {
        statusText.textContent = isActive ? 'Active' : 'Not enabled';
        statusText.style.color = isActive ? '#22C55E' : '#64748B';
    }
    if (enableBtn) {
        enableBtn.textContent = isActive ? 'Update' : 'Enable';
    }
    if (coordsDiv && coordDisplay && isActive && lat && lon) {
        coordDisplay.textContent = lat.toFixed(5) + '°, ' + lon.toFixed(5) + '°';
        coordsDiv.style.display = 'flex';
    } else if (coordsDiv) {
        coordsDiv.style.display = 'none';
    }
}

function getLocation() {
    showToast('Getting your location...', 'info');
    
    if (!("geolocation" in navigator)) {
        showToast('Geolocation not supported', 'error');
        return;
    }
    
    var options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            
            userLocation = { lat: lat, lon: lon };
            locationConsentGiven = true;
            
            var success = await saveLocationToServer(lat, lon);
            
            if (success) {
                updateProfileLocationUI(true, lat, lon);
                hideLocationBanner();
                showToast('Location updated!', 'success');
                if (currentFilter === 'nearby') loadTasks();
            } else {
                showToast('Failed to save location', 'error');
            }
        },
        function(error) {
            console.error('Geolocation error:', error);
            var message = '';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location permission denied.';
                    showLocationBanner();
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'GPS signal weak. Try manual entry.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
                default:
                    message = 'Could not get location.';
            }
            showToast(message, 'error');
            updateProfileLocationUI(false);
        },
        options
    );
}

async function saveLocationToServer(lat, lon) {
    try {
        const response = await axios.post('/api/update-location', {
            latitude: lat,
            longitude: lon,
            consent: true
        });
        return response.data.success === true;
    } catch (error) {
        console.error('Error saving location:', error);
        return false;
    }
}

async function setManualLocation() {
    var latInput = document.getElementById('manualLat');
    var lonInput = document.getElementById('manualLon');
    
    var lat = parseFloat(latInput?.value);
    var lon = parseFloat(lonInput?.value);
    
    if (isNaN(lat) || isNaN(lon)) {
        showToast('Please enter valid latitude and longitude', 'error');
        return;
    }
    
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        showToast('Invalid coordinates', 'error');
        return;
    }
    
    userLocation = { lat: lat, lon: lon };
    locationConsentGiven = true;
    var success = await saveLocationToServer(lat, lon);
    
    if (success) {
        updateProfileLocationUI(true, lat, lon);
        hideLocationBanner();
        showToast('Manual location set!', 'success');
        if (currentFilter === 'nearby') loadTasks();
    } else {
        showToast('Failed to save location', 'error');
    }
}

function showLocationBanner() {
    if (!locationBanner) return;
    if (userLocation && locationConsentGiven) return;
    locationBanner.style.display = 'flex';
}

function hideLocationBanner() {
    if (locationBanner) {
        locationBanner.style.display = 'none';
    }
}

// ============ PROFILE FUNCTIONS ============
async function loadUserProfile() {
    try {
        const response = await axios.get('/api/user-status');
        var user = response.data;
        
        var nameInput = document.getElementById('profileNameInput');
        var completedEl = document.getElementById('completedCount');
        var ratingEl = document.getElementById('ratingDisplay');
        
        if (nameInput) nameInput.value = user.username || 'Guest User';
        if (completedEl) completedEl.textContent = user.completed_tasks || 0;
        if (ratingEl) ratingEl.textContent = user.rating || 0;
        
        if (user.is_verified) {
            var verificationSection = document.getElementById('verificationSection');
            if (verificationSection) verificationSection.style.display = 'none';
            var badge = document.getElementById('verificationBadge');
            if (badge) badge.style.display = 'inline-flex';
            
            // Show backup code section if backup code exists
            if (user.backup_code) {
                currentBackupCode = user.backup_code;
                var backupCodeDisplay = document.getElementById('backupCodeDisplay');
                var backupCodeSection = document.getElementById('backupCodeSection');
                if (backupCodeDisplay && backupCodeSection) {
                    // Format backup code for display (XXXX XXXX)
                    var code = user.backup_code;
                    if (code && code.length === 8) {
                        backupCodeDisplay.innerHTML = code.substring(0, 4) + ' ' + code.substring(4, 8);
                    } else {
                        backupCodeDisplay.innerHTML = code;
                    }
                    backupCodeSection.style.display = 'block';
                }
            }
        } else {
            var verificationSection = document.getElementById('verificationSection');
            if (verificationSection) verificationSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function saveUserName() {
    var nameInput = document.getElementById('profileNameInput');
    var newName = nameInput.value.trim();
    
    if (!newName || newName === 'Guest User') {
        showToast('Please enter a valid name', 'error');
        return;
    }
    
    var saveBtn = document.getElementById('saveNameBtn');
    var originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await axios.post('/api/set-name', { name: newName });
        if (response.data.success) {
            showToast('Name saved!', 'success');
        } else {
            showToast('Failed to save name', 'error');
        }
    } catch (error) {
        showToast('Failed to save name', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// ============ VERIFICATION FUNCTIONS WITH BACKUP CODE ============
async function sendVerificationCode() {
    var name = document.getElementById('verificationName').value.trim();
    var email = document.getElementById('verificationEmail').value.trim();
    
    if (!name) {
        showToast('Please enter your full name', 'error');
        return;
    }
    
    if (!email || !email.endsWith('@kuhes.ac.mw')) {
        showToast('Please use your @kuhes.ac.mw email', 'error');
        return;
    }
    
    var sendBtn = document.getElementById('sendVerificationBtn');
    var originalText = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    
    try {
        await axios.post('/api/set-name', { name: name });
        
        const response = await axios.post('/api/send-verification', { email: email });
        if (response.data.success) {
            showToast('Verification code sent!', 'success');
            document.getElementById('verificationInputGroup').style.display = 'none';
            document.getElementById('verificationCodeGroup').style.display = 'flex';
        } else {
            showToast(response.data.error || 'Failed to send code', 'error');
        }
    } catch (error) {
        showToast('Failed to send code', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;
    }
}

async function verifyCode() {
    var code = document.getElementById('verificationCode').value.trim();
    
    if (!code || code.length !== 6) {
        showToast('Please enter the 6-digit code', 'error');
        return;
    }
    
    var verifyBtn = document.getElementById('verifyCodeBtn');
    var originalText = verifyBtn.textContent;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = 'Verifying...';
    
    try {
        const response = await axios.post('/api/verify-code', { code: code });
        if (response.data.success) {
            showToast('Email verified successfully!', 'success');
            
            // Hide verification section
            var verificationSection = document.getElementById('verificationSection');
            if (verificationSection) verificationSection.style.display = 'none';
            
            var badge = document.getElementById('verificationBadge');
            if (badge) badge.style.display = 'inline-flex';
            
            // SHOW BACKUP CODE
            if (response.data.backup_code) {
                currentBackupCode = response.data.backup_code;
                var backupCodeDisplay = document.getElementById('backupCodeDisplay');
                var backupCodeSection = document.getElementById('backupCodeSection');
                
                if (backupCodeDisplay && backupCodeSection) {
                    // Format backup code for display (XXXX XXXX)
                    var backupCode = response.data.backup_code;
                    if (backupCode && backupCode.length === 8) {
                        backupCodeDisplay.innerHTML = backupCode.substring(0, 4) + ' ' + backupCode.substring(4, 8);
                    } else {
                        backupCodeDisplay.innerHTML = backupCode;
                    }
                    backupCodeSection.style.display = 'block';
                }
                
                showToast('Your backup code has been generated!', 'info');
            }
            
            await loadUserProfile();
        } else {
            showToast(response.data.error || 'Invalid code', 'error');
        }
    } catch (error) {
        console.error('Verify code error:', error);
        showToast('Verification failed', 'error');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
    }
}

// ============ BACKUP CODE FUNCTIONS ============
// Copy backup code to clipboard
async function copyBackupCode() {
    if (!currentBackupCode) {
        // Try to get from display
        var backupDisplay = document.getElementById('backupCodeDisplay');
        if (backupDisplay && backupDisplay.innerHTML) {
            currentBackupCode = backupDisplay.innerHTML.replace(/\s/g, '');
        } else {
            showToast('No backup code available', 'error');
            return;
        }
    }
    
    var cleanCode = currentBackupCode.replace(/\s/g, '');
    
    try {
        await navigator.clipboard.writeText(cleanCode);
        showToast('Backup code copied to clipboard!', 'success');
    } catch (err) {
        // Fallback for older browsers
        var textarea = document.createElement('textarea');
        textarea.value = cleanCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Backup code copied!', 'success');
    }
}

// Download backup code as image
function downloadBackupCode() {
    var displayCode = document.getElementById('backupCodeDisplay');
    if (!displayCode || !displayCode.innerHTML) {
        showToast('No backup code available', 'error');
        return;
    }
    
    var codeToSave = displayCode.innerHTML.replace(/\s/g, '');
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 450;
    canvas.height = 350;
    
    // Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Gradient border
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Title
    ctx.fillStyle = '#60A5FA';
    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔐 SendMe Backup Code', canvas.width / 2, 55);
    
    // Divider line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 75);
    ctx.lineTo(canvas.width - 50, 75);
    ctx.stroke();
    
    // Code
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 36px Courier New, monospace';
    ctx.fillText(codeToSave, canvas.width / 2, 150);
    
    // Instruction
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.fillText('Use this code to verify your account', canvas.width / 2, 210);
    ctx.fillText('on other devices without checking email', canvas.width / 2, 235);
    
    // Warning
    ctx.fillStyle = '#FBBF24';
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.fillText('⚠️ Keep this code safe and secure!', canvas.width / 2, 285);
    
    // Footer
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Inter, Arial, sans-serif';
    ctx.fillText('Generated by SendMe', canvas.width / 2, 325);
    
    // Download
    var link = document.createElement('a');
    link.download = 'sendme_backup_code.png';
    link.href = canvas.toDataURL();
    link.click();
    
    showToast('Backup code saved as image!', 'success');
}

// Backup code login on new device
async function verifyWithBackup() {
    var email = document.getElementById('backupLoginEmail').value.trim();
    var code = document.getElementById('backupLoginCode').value.trim();
    
    if (!email || !code) {
        showToast('Enter email and backup code', 'error');
        return;
    }
    
    // Remove spaces from backup code for validation
    var cleanCode = code.replace(/\s/g, '');
    
    if (cleanCode.length !== 8) {
        showToast('Please enter a valid 8-digit backup code', 'error');
        return;
    }
    
    var verifyBtn = document.getElementById('verifyBackupBtn');
    var originalText = verifyBtn.textContent;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = 'Verifying...';
    
    try {
        const response = await axios.post('/api/verify-with-backup', { 
            email: email, 
            backup_code: cleanCode 
        });
        
        if (response.data.success) {
            showToast('Device verified using backup code!', 'success');
            
            // Hide verification sections
            var verificationSection = document.getElementById('verificationSection');
            if (verificationSection) verificationSection.style.display = 'none';
            
            var backupLoginSection = document.getElementById('backupLoginSection');
            if (backupLoginSection) backupLoginSection.style.display = 'none';
            
            var badge = document.getElementById('verificationBadge');
            if (badge) badge.style.display = 'inline-flex';
            
            // Reload profile
            await loadUserProfile();
            await loadTasks();
        } else {
            showToast('Invalid email or backup code', 'error');
        }
    } catch (error) {
        console.error('Backup verification error:', error);
        showToast(error.response?.data?.error || 'Invalid email or backup code', 'error');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
    }
}

// Toggle between email and backup login
function toggleBackupLogin() {
    var emailGroup = document.getElementById('verificationInputGroup');
    var codeGroup = document.getElementById('verificationCodeGroup');
    var backupGroup = document.getElementById('backupLoginSection');
    
    if (emailGroup && backupGroup) {
        if (emailGroup.style.display !== 'none') {
            emailGroup.style.display = 'none';
            if (codeGroup) codeGroup.style.display = 'none';
            backupGroup.style.display = 'block';
        } else {
            emailGroup.style.display = 'flex';
            if (codeGroup) codeGroup.style.display = 'flex';
            backupGroup.style.display = 'none';
        }
    }
}

// Setup backup code listeners
function setupBackupCodeListeners() {
    var copyBtn = document.getElementById('copyBackupCodeBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyBackupCode);
    
    var downloadBtn = document.getElementById('downloadBackupCodeBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadBackupCode);
    
    var backupLoginBtn = document.getElementById('showBackupLoginBtn');
    if (backupLoginBtn) backupLoginBtn.addEventListener('click', toggleBackupLogin);
    
    var verifyBackupBtn = document.getElementById('verifyBackupBtn');
    if (verifyBackupBtn) verifyBackupBtn.addEventListener('click', verifyWithBackup);
}

// ============ NAVIGATION FUNCTIONS ============
function setupNavigation() {
    var navItems = document.querySelectorAll('.bottom-nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].addEventListener('click', function() {
            var view = this.dataset.nav;
            navigateTo(view);
        });
    }
    
    var logoBtn = document.getElementById('logoBtn');
    if (logoBtn) logoBtn.addEventListener('click', function() { navigateTo('feed'); });
}

function navigateTo(view) {
    switchView(view);
}

function switchView(view) {
    currentView = view;
    
    var navItems = document.querySelectorAll('.bottom-nav-item');
    for (var i = 0; i < navItems.length; i++) {
        var btnView = navItems[i].dataset.nav;
        if (btnView === view) {
            navItems[i].classList.add('active');
        } else {
            navItems[i].classList.remove('active');
        }
    }
    
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
        views[i].classList.remove('active');
    }
    
    if (view === 'feed') {
        var feedView = document.getElementById('feedView');
        if (feedView) feedView.classList.add('active');
        loadTasks();
    } else if (view === 'my-tasks') {
        var myTasksView = document.getElementById('myTasksView');
        if (myTasksView) myTasksView.classList.add('active');
        loadMyTasks();
    } else if (view === 'profile') {
        var profileView = document.getElementById('profileView');
        if (profileView) profileView.classList.add('active');
        loadUserProfile();
        refreshLocationDisplay();
    }
}

async function refreshLocationDisplay() {
    try {
        const response = await axios.get('/api/location-status');
        if (response.data.has_location && response.data.consent_given) {
            userLocation = { lat: response.data.latitude, lon: response.data.longitude };
            locationConsentGiven = true;
            updateProfileLocationUI(true, response.data.latitude, response.data.longitude);
            hideLocationBanner();
        } else {
            updateProfileLocationUI(false);
        }
    } catch (error) {
        console.error('Error refreshing location:', error);
    }
}

// ============ TASK TYPE SELECTOR ============
function setupTaskTypeSelector() {
    var typeSelectBtns = document.querySelectorAll('.type-select-btn');
    for (var i = 0; i < typeSelectBtns.length; i++) {
        typeSelectBtns[i].addEventListener('click', function() {
            var allBtns = document.querySelectorAll('.type-select-btn');
            for (var j = 0; j < allBtns.length; j++) {
                allBtns[j].classList.remove('active');
            }
            this.classList.add('active');
            var taskType = this.dataset.type;
            toggleTaskTypeFields(taskType);
        });
    }
    
    var typeChips = document.querySelectorAll('.type-chip');
    for (var i = 0; i < typeChips.length; i++) {
        typeChips[i].addEventListener('click', function() {
            var allChips = document.querySelectorAll('.type-chip');
            for (var j = 0; j < allChips.length; j++) {
                allChips[j].classList.remove('active');
            }
            this.classList.add('active');
            currentType = this.dataset.type;
            loadTasks();
        });
    }
}

function toggleTaskTypeFields(taskType) {
    var helpMe = document.getElementById('helpMeFields');
    var sendMe = document.getElementById('sendMeFields');
    var deliver = document.getElementById('deliverFields');
    var groupBuy = document.getElementById('groupBuyFields');
    
    if (helpMe) helpMe.style.display = taskType === 'help_me' ? 'block' : 'none';
    if (sendMe) sendMe.style.display = taskType === 'send_me' ? 'block' : 'none';
    if (deliver) deliver.style.display = taskType === 'deliver' ? 'block' : 'none';
    if (groupBuy) groupBuy.style.display = taskType === 'group_buy' ? 'block' : 'none';
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Filter chips
    var chips = document.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
        chips[i].addEventListener('click', function() {
            var allChips = document.querySelectorAll('.chip');
            for (var j = 0; j < allChips.length; j++) {
                allChips[j].classList.remove('active');
            }
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadTasks();
        });
    }
    
    // Nearby filter
    var nearbyBtn = document.getElementById('nearbyFilterBtn');
    if (nearbyBtn) {
        nearbyBtn.addEventListener('click', function() {
            if (!userLocation) {
                showLocationBanner();
                showToast('Enable location to see nearby tasks', 'info');
                return;
            }
            currentFilter = 'nearby';
            loadTasks();
        });
    }
    
    // Location buttons
    var enableProfileBtn = document.getElementById('enableLocationProfileBtn');
    if (enableProfileBtn) enableProfileBtn.addEventListener('click', function() { getLocation(); });
    
    var retryBtn = document.getElementById('retryLocationBtn');
    if (retryBtn) retryBtn.addEventListener('click', function() { getLocation(); });
    
    var setManualBtn = document.getElementById('setManualLocationBtn');
    if (setManualBtn) setManualBtn.addEventListener('click', function() { setManualLocation(); });
    
    var enableBannerBtn = document.getElementById('enableLocationBtn');
    if (enableBannerBtn) {
        enableBannerBtn.addEventListener('click', function() {
            hideLocationBanner();
            getLocation();
        });
    }
    
    var dismissBannerBtn = document.getElementById('dismissBannerBtn');
    if (dismissBannerBtn) dismissBannerBtn.addEventListener('click', function() { hideLocationBanner(); });
    
    // Search
    if (searchInput) searchInput.addEventListener('input', function() { filterTasks(); });
    
    // Modals
    var openPostBtn = document.getElementById('openPostModal');
    if (openPostBtn) openPostBtn.addEventListener('click', function() { openModal(postModal); });
    
    var closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', function() { closeModal(postModal); });
    
    var closeTaskModalBtn = document.getElementById('closeTaskModal');
    if (closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', function() { closeModal(taskModal); });
    
    var closeCandidatesModalBtn = document.getElementById('closeCandidatesModal');
    if (closeCandidatesModalBtn) closeCandidatesModalBtn.addEventListener('click', function() { closeModal(candidatesModal); });
    
    var closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
    if (closeConfirmModalBtn) closeConfirmModalBtn.addEventListener('click', function() { closeModal(confirmModal); });
    
    var closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', function() {
            if (notificationsPanel) notificationsPanel.style.display = 'none';
        });
    }
    
    var notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', function() {
            if (notificationsPanel) {
                notificationsPanel.style.display = notificationsPanel.style.display === 'none' ? 'block' : 'none';
                loadNotifications();
            }
        });
    }
    
    var overlays = document.querySelectorAll('.modal-overlay');
    for (var i = 0; i < overlays.length; i++) {
        overlays[i].addEventListener('click', function() {
            closeModal(postModal);
            closeModal(taskModal);
            closeModal(confirmModal);
            closeModal(candidatesModal);
        });
    }
    
    // Post form
    var postForm = document.getElementById('postTaskForm');
    if (postForm) postForm.addEventListener('submit', function(e) { handlePostTask(e); });
    
    // Urgency buttons
    var urgencyBtns = document.querySelectorAll('.urgency-btn');
    for (var i = 0; i < urgencyBtns.length; i++) {
        urgencyBtns[i].addEventListener('click', function() {
            var allBtns = document.querySelectorAll('.urgency-btn');
            for (var j = 0; j < allBtns.length; j++) {
                allBtns[j].classList.remove('active');
            }
            this.classList.add('active');
        });
    }
    
    // Tasks tabs
    var tasksTabs = document.querySelectorAll('.tasks-tab');
    for (var i = 0; i < tasksTabs.length; i++) {
        tasksTabs[i].addEventListener('click', function() {
            var tabName = this.dataset.tab;
            var allTabs = document.querySelectorAll('.tasks-tab');
            for (var j = 0; j < allTabs.length; j++) {
                allTabs[j].classList.remove('active');
            }
            this.classList.add('active');
            
            var postedDiv = document.getElementById('postedTasks');
            var acceptedDiv = document.getElementById('acceptedTasks');
            var candidatesDiv = document.getElementById('candidatesTasks');
            
            if (postedDiv) postedDiv.style.display = tabName === 'posted' ? 'block' : 'none';
            if (acceptedDiv) acceptedDiv.style.display = tabName === 'accepted' ? 'block' : 'none';
            if (candidatesDiv) candidatesDiv.style.display = tabName === 'candidates' ? 'block' : 'none';
        });
    }
    
    // Confirm modal buttons
    var closeConfirmBtn = document.getElementById('closeConfirmBtn');
    if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', function() { closeModal(confirmModal); });
    
    var openWhatsAppBtn = document.getElementById('openWhatsAppBtn');
    if (openWhatsAppBtn) {
        openWhatsAppBtn.addEventListener('click', function() {
            if (pendingWhatsAppLink) window.open(pendingWhatsAppLink, '_blank');
            closeModal(confirmModal);
            pendingWhatsAppLink = null;
        });
    }
    
    // Verification buttons
    var sendVerificationBtn = document.getElementById('sendVerificationBtn');
    if (sendVerificationBtn) sendVerificationBtn.addEventListener('click', function() { sendVerificationCode(); });
    
    var verifyCodeBtn = document.getElementById('verifyCodeBtn');
    if (verifyCodeBtn) verifyCodeBtn.addEventListener('click', function() { verifyCode(); });
    
    // Save name button
    var saveNameBtn = document.getElementById('saveNameBtn');
    if (saveNameBtn) saveNameBtn.addEventListener('click', function() { saveUserName(); });
    
    var profileNameInput = document.getElementById('profileNameInput');
    if (profileNameInput) {
        profileNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') saveUserName();
        });
    }
    
    // Settings
    var autoLocationCheckbox = document.getElementById('autoLocationCheckbox');
    if (autoLocationCheckbox) {
        var saved = localStorage.getItem('autoLocation') === 'true';
        autoLocationCheckbox.checked = saved;
        autoLocationCheckbox.addEventListener('change', function(e) {
            localStorage.setItem('autoLocation', e.target.checked);
            if (e.target.checked && !userLocation) getLocation();
        });
    }
}

// ============ TASK FUNCTIONS ============
async function loadTasks() {
    showSkeleton();
    try {
        var url = '/api/tasks?filter=' + currentFilter;
        if (currentType !== 'all') url = url + '&type=' + currentType;
        if (userLocation && currentFilter === 'nearby') {
            url = url + '&lat=' + userLocation.lat + '&lon=' + userLocation.lon;
        }
        const response = await axios.get(url);
        currentTasks = response.data;
        renderTasks(currentTasks);
        if (tasksCount) {
            tasksCount.textContent = currentTasks.length + ' task' + (currentTasks.length !== 1 ? 's' : '');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showToast('Failed to load tasks', 'error');
    }
}

async function loadMyTasks() {
    try {
        var url = '/api/my-tasks';
        if (userLocation) url = url + '?lat=' + userLocation.lat + '&lon=' + userLocation.lon;
        const response = await axios.get(url);
        
        var postedContainer = document.getElementById('postedTasks');
        var acceptedContainer = document.getElementById('acceptedTasks');
        
        if (postedContainer) {
            if (response.data.posted?.length === 0) {
                postedContainer.innerHTML = '<div class="empty-state">No tasks posted yet</div>';
            } else {
                var postedHtml = '';
                for (var i = 0; i < response.data.posted.length; i++) {
                    postedHtml += createSimpleTaskCard(response.data.posted[i]);
                }
                postedContainer.innerHTML = postedHtml;
            }
        }
        
        if (acceptedContainer) {
            if (response.data.accepted?.length === 0) {
                acceptedContainer.innerHTML = '<div class="empty-state">No tasks accepted yet</div>';
            } else {
                var acceptedHtml = '';
                for (var i = 0; i < response.data.accepted.length; i++) {
                    acceptedHtml += createSimpleTaskCard(response.data.accepted[i]);
                }
                acceptedContainer.innerHTML = acceptedHtml;
            }
        }
        
        var candidatesResponse = await axios.get('/api/my-candidates');
        var candidatesContainer = document.getElementById('candidatesTasks');
        if (candidatesContainer) {
            if (candidatesResponse.data?.length === 0) {
                candidatesContainer.innerHTML = '<div class="empty-state">No pending applications</div>';
            } else {
                var candidatesHtml = '';
                for (var i = 0; i < candidatesResponse.data.length; i++) {
                    candidatesHtml += createSimpleTaskCard(candidatesResponse.data[i]);
                }
                candidatesContainer.innerHTML = candidatesHtml;
            }
        }
    } catch (error) {
        console.error('Error loading my tasks:', error);
    }
}

function createSimpleTaskCard(task) {
    var typeIconMap = {
        'help_me': '<i class="fas fa-hand-paper"></i>',
        'send_me': '<i class="fas fa-car"></i>',
        'deliver': '<i class="fas fa-box"></i>',
        'group_buy': '<i class="fas fa-users"></i>'
    };
    var icon = typeIconMap[task.task_type] || '';
    return `
        <div class="task-card" onclick="window.openTaskDetail(${task.id})">
            <div class="task-card-header">
                <h3 class="task-title">${icon} ${escapeHtml(task.title)}</h3>
                <span class="status-badge ${task.status}">${task.status}</span>
            </div>
            <div class="task-details">
                ${task.payment ? '<div class="task-detail-item">MK ' + task.payment.toLocaleString() + '</div>' : ''}
                <div class="task-detail-item">${escapeHtml(task.location_name)}</div>
                <div class="task-detail-item">${task.time_ago}</div>
            </div>
        </div>
    `;
}

function renderTasks(tasks) {
    if (!tasksGrid) return;
    
    if (tasks.length === 0) {
        tasksGrid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No tasks available</p><button class="post-task-btn" id="emptyPostBtn">Post a Task</button></div>';
        var emptyPostBtn = document.getElementById('emptyPostBtn');
        if (emptyPostBtn) emptyPostBtn.addEventListener('click', function() { openModal(postModal); });
        return;
    }
    
    var typeIconMap = {
        'help_me': '<i class="fas fa-hand-paper"></i>',
        'send_me': '<i class="fas fa-car"></i>',
        'deliver': '<i class="fas fa-box"></i>',
        'group_buy': '<i class="fas fa-users"></i>'
    };
    
    var tasksHtml = '';
    for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        var distanceHtml = '';
        if (task.distance && task.distance > 0) {
            var distanceText = task.distance < 1 ? (task.distance * 1000).toFixed(0) + 'm' : task.distance.toFixed(1) + 'km';
            distanceHtml = '<span class="distance-badge"><i class="fas fa-road"></i> ' + distanceText + '</span>';
        }
        
        var candidateHtml = '';
        if (task.candidate_count > 0) {
            candidateHtml = '<span class="candidate-badge"><i class="fas fa-users"></i> ' + task.candidate_count + '/' + task.max_candidates + '</span>';
        }
        
        tasksHtml += `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span class="task-type-icon">${typeIconMap[task.task_type] || ''}</span>
                        <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    </div>
                    <span class="urgency-badge ${task.urgency.toLowerCase()}">${task.urgency}</span>
                </div>
                <div class="task-details">
                    ${task.payment ? '<div class="task-detail-item"><i class="fas fa-money-bill-wave"></i> MK ' + task.payment.toLocaleString() + '</div>' : ''}
                    <div class="task-detail-item"><i class="fas fa-location-dot"></i> ${escapeHtml(task.location_name)}</div>
                    <div class="task-detail-item"><i class="fas fa-clock"></i> ${task.time_ago}</div>
                    ${distanceHtml}
                    ${candidateHtml}
                </div>
                <p class="task-preview">${escapeHtml(task.description || 'No description')}</p>
                <button class="accept-btn" onclick="event.stopPropagation(); window.applyForTask(${task.id})"><i class="fas fa-hand-peace"></i> I'll do it</button>
            </div>
        `;
    }
    tasksGrid.innerHTML = tasksHtml;
    
    var cards = document.querySelectorAll('.task-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].addEventListener('click', function(e) {
            if (!e.target.classList.contains('accept-btn')) {
                var taskId = parseInt(this.dataset.taskId);
                window.openTaskDetail(taskId);
            }
        });
    }
}

async function openTaskDetail(taskId) {
    try {
        var url = '/api/task/' + taskId;
        if (userLocation) url = url + '?lat=' + userLocation.lat + '&lon=' + userLocation.lon;
        const response = await axios.get(url);
        var task = response.data;
        currentTaskData = task;
        
        document.getElementById('modalTaskTitle').textContent = task.title;
        document.getElementById('modalPayment').textContent = task.payment ? 'MK ' + task.payment.toLocaleString() : 'Negotiable';
        document.getElementById('modalLocation').textContent = task.location_name;
        document.getElementById('modalUrgency').textContent = task.urgency;
        document.getElementById('modalDescription').textContent = task.description || 'No description provided.';
        document.getElementById('modalTime').textContent = task.time_ago;
        
        var typeBadge = document.getElementById('taskTypeBadge');
        var typeNames = { 'help_me': 'Help Me', 'send_me': 'Send Me', 'deliver': 'Deliver', 'group_buy': 'Group Buy' };
        if (typeBadge) {
            typeBadge.textContent = typeNames[task.task_type] || 'Task';
            typeBadge.className = 'task-type-badge ' + task.task_type;
        }
        
        var sendMeInfo = document.getElementById('modalSendMeInfo');
        if (task.task_type === 'send_me' && task.departure_location) {
            var departureEl = document.getElementById('modalDeparture');
            var destinationEl = document.getElementById('modalDestination');
            var timeEl = document.getElementById('modalDepartureTime');
            var seatsEl = document.getElementById('modalSeats');
            if (departureEl) departureEl.textContent = task.departure_location;
            if (destinationEl) destinationEl.textContent = task.destination_location;
            if (timeEl) timeEl.textContent = task.departure_time ? new Date(task.departure_time).toLocaleString() : 'TBD';
            if (seatsEl) seatsEl.textContent = task.available_seats;
            sendMeInfo.style.display = 'block';
        } else if (sendMeInfo) {
            sendMeInfo.style.display = 'none';
        }
        
        var distanceContainer = document.getElementById('modalDistanceContainer');
        var distanceSpan = document.getElementById('modalDistance');
        if (task.distance && task.distance > 0) {
            var distanceText = task.distance < 1 ? (task.distance * 1000).toFixed(0) + ' meters' : task.distance.toFixed(1) + ' km';
            if (distanceContainer) distanceContainer.style.display = 'flex';
            if (distanceSpan) distanceSpan.textContent = distanceText;
        } else if (distanceContainer) {
            distanceContainer.style.display = 'none';
        }
        
        var candidateInfo = document.getElementById('candidateInfo');
        var candidateCountSpan = document.getElementById('candidateCount');
        if (task.candidate_count > 0 && candidateInfo) {
            candidateInfo.style.display = 'block';
            if (candidateCountSpan) candidateCountSpan.textContent = task.candidate_count;
        } else if (candidateInfo) {
            candidateInfo.style.display = 'none';
        }
        
        var actionButtons = document.getElementById('taskActionButtons');
        const userResponse = await axios.get('/api/user-status');
        var isPoster = userResponse.data.id === task.user_id;
        
        if (actionButtons) {
            if (isPoster) {
                if (task.status === 'open' || task.status === 'pending') {
                    actionButtons.innerHTML = '<button class="view-candidates-btn" onclick="viewCandidates(' + task.id + ')"><i class="fas fa-users"></i> View Applicants (' + task.candidate_count + ')</button>';
                } else if (task.status === 'assigned') {
                    actionButtons.innerHTML = '<button class="complete-task-btn" onclick="completeTask(' + task.id + ')"><i class="fas fa-check-circle"></i> Mark as Completed</button>';
                } else {
                    actionButtons.innerHTML = '';
                }
            } else {
                if (task.status === 'open') {
                    actionButtons.innerHTML = '<button class="accept-task-btn" onclick="applyForTask(' + task.id + ')"><i class="fas fa-hand-peace"></i> Apply for this Task</button>';
                } else if (task.status === 'pending') {
                    actionButtons.innerHTML = '<button class="pending-btn" disabled><i class="fas fa-clock"></i> Application Pending</button>';
                } else if (task.status === 'assigned') {
                    actionButtons.innerHTML = '<button class="assigned-btn" disabled><i class="fas fa-check"></i> Task Assigned</button>';
                } else {
                    actionButtons.innerHTML = '';
                }
            }
        }
        
        openModal(taskModal);
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load task details', 'error');
    }
}

async function applyForTask(taskId) {
    try {
        const response = await axios.post('/api/task/' + taskId + '/accept');
        if (response.data.success) {
            closeModal(taskModal);
            
            var confirmMessage = document.getElementById('confirmMessage');
            var confirmTitle = document.getElementById('confirmTitle');
            var candidateStatusInfo = document.getElementById('candidateStatusInfo');
            var whatsappInfo = document.getElementById('whatsappInfo');
            var openWhatsAppBtn = document.getElementById('openWhatsAppBtn');
            
            if (confirmTitle) confirmTitle.textContent = 'Application Submitted!';
            if (confirmMessage) confirmMessage.textContent = response.data.message || 'You have applied for this task.';
            
            if (response.data.candidate_count && candidateStatusInfo) {
                var positionSpan = document.getElementById('userCandidatePosition');
                var totalSpan = document.getElementById('totalCandidates');
                if (positionSpan) positionSpan.textContent = response.data.candidate_count;
                if (totalSpan) totalSpan.textContent = response.data.max_candidates;
                candidateStatusInfo.style.display = 'block';
            } else if (candidateStatusInfo) {
                candidateStatusInfo.style.display = 'none';
            }
            
            if (whatsappInfo) whatsappInfo.style.display = 'none';
            if (openWhatsAppBtn) openWhatsAppBtn.style.display = 'none';
            
            openModal(confirmModal);
            loadTasks();
            if (currentView === 'my-tasks') loadMyTasks();
        } else {
            showToast(response.data.error || 'Failed to apply', 'error');
        }
    } catch (error) {
        showToast(error.response?.data?.error || 'Failed to apply', 'error');
    }
}

async function viewCandidates(taskId) {
    try {
        const response = await axios.get('/api/task/' + taskId + '/candidates');
        var candidates = response.data.candidates;
        
        var candidatesList = document.getElementById('candidatesList');
        if (candidatesList) {
            if (candidates.length === 0) {
                candidatesList.innerHTML = '<div class="empty-state">No applicants yet</div>';
            } else {
                var candidatesHtml = '';
                for (var i = 0; i < candidates.length; i++) {
                    var candidate = candidates[i];
                    candidatesHtml += `
                        <div class="candidate-item">
                            <div class="candidate-info">
                                <div class="candidate-name">${escapeHtml(candidate.user?.username || 'Anonymous')}</div>
                                ${candidate.message ? '<div class="candidate-message">"' + escapeHtml(candidate.message) + '"</div>' : ''}
                                <div class="candidate-message">Applied ${new Date(candidate.created_at).toLocaleString()}</div>
                            </div>
                            <button class="select-candidate-btn" onclick="selectCandidate(${taskId}, ${candidate.id})">Select</button>
                        </div>
                    `;
                }
                candidatesList.innerHTML = candidatesHtml;
            }
        }
        
        openModal(candidatesModal);
    } catch (error) {
        console.error('Error loading candidates:', error);
        showToast('Failed to load applicants', 'error');
    }
}

async function selectCandidate(taskId, candidateId) {
    try {
        const response = await axios.post('/api/task/' + taskId + '/select/' + candidateId);
        if (response.data.success) {
            showToast('Candidate selected! They have been notified.', 'success');
            closeModal(candidatesModal);
            loadTasks();
            loadMyTasks();
        }
    } catch (error) {
        showToast('Failed to select candidate', 'error');
    }
}

async function completeTask(taskId) {
    try {
        const response = await axios.post('/api/task/' + taskId + '/complete');
        if (response.data.success) {
            showToast('Task marked as completed!', 'success');
            loadTasks();
            loadMyTasks();
            closeModal(taskModal);
        }
    } catch (error) {
        showToast('Failed to complete task', 'error');
    }
}

async function handlePostTask(e) {
    e.preventDefault();
    
    var activeType = document.querySelector('.type-select-btn.active');
    var taskType = activeType ? activeType.dataset.type : 'help_me';
    var title = document.getElementById('taskTitle').value;
    var description = document.getElementById('taskDescription').value;
    var location_name = document.getElementById('taskLocation').value;
    var activeUrgency = document.querySelector('.urgency-btn.active');
    var urgency = activeUrgency ? activeUrgency.dataset.urgency : 'Anytime';
    var phone = document.getElementById('userPhone').value;
    var shareLocation = document.getElementById('shareLocationCheckbox').checked;
    
    if (!title) {
        showToast('Please enter a title', 'error');
        return;
    }
    
    if (phone) {
        try {
            await axios.post('/api/set-phone', { phone: phone });
        } catch (error) {
            console.error('Error saving phone:', error);
        }
    }
    
    var taskData = {
        title: title, description: description, location_name: location_name, urgency: urgency, task_type: taskType,
        latitude: shareLocation && userLocation ? userLocation.lat : null,
        longitude: shareLocation && userLocation ? userLocation.lon : null
    };
    
    if (taskType === 'help_me') {
        var payment = document.getElementById('taskPayment').value;
        taskData.payment = payment ? parseInt(payment) : null;
    } else if (taskType === 'send_me') {
        taskData.departure_location = document.getElementById('departureLocation')?.value;
        taskData.destination_location = document.getElementById('destinationLocation')?.value;
        taskData.departure_time = document.getElementById('departureTime')?.value;
        taskData.available_seats = parseInt(document.getElementById('availableSeats')?.value) || 1;
        var sendPayment = document.getElementById('taskPaymentSend')?.value;
        taskData.payment = sendPayment ? parseInt(sendPayment) : null;
    } else if (taskType === 'deliver') {
        taskData.pickup_location = document.getElementById('pickupLocation')?.value;
        taskData.delivery_location = document.getElementById('deliveryLocation')?.value;
        var fee = document.getElementById('deliveryFee')?.value;
        taskData.payment = fee ? parseInt(fee) : null;
    } else if (taskType === 'group_buy') {
        taskData.product_name = document.getElementById('productName')?.value;
        var price = document.getElementById('pricePerPerson')?.value;
        taskData.payment = price ? parseInt(price) : null;
        taskData.available_seats = parseInt(document.getElementById('groupSlots')?.value) || 2;
    }
    
    try {
        const response = await axios.post('/api/task/create', taskData);
        if (response.data.success) {
            showToast('Task posted successfully!');
            closeModal(postModal);
            document.getElementById('postTaskForm').reset();
            navigateTo('feed');
            loadTasks();
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to post task', 'error');
    }
}

function filterTasks() {
    var searchTerm = searchInput.value.toLowerCase();
    var filtered = [];
    for (var i = 0; i < currentTasks.length; i++) {
        var task = currentTasks[i];
        if (task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm))) {
            filtered.push(task);
        }
    }
    renderTasks(filtered);
    if (tasksCount) tasksCount.textContent = filtered.length + ' task' + (filtered.length !== 1 ? 's' : '');
}

function showSkeleton() {
    if (tasksGrid) {
        tasksGrid.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    }
}

function openModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============ NOTIFICATION FUNCTIONS ============
function startNotificationPolling() {
    if (notificationCheckInterval) clearInterval(notificationCheckInterval);
    notificationCheckInterval = setInterval(function() {
        loadNotifications();
    }, 5000);
}

async function loadNotifications() {
    try {
        const response = await axios.get('/api/notifications');
        var notifications = response.data;
        var unreadCount = 0;
        for (var i = 0; i < notifications.length; i++) {
            if (!notifications[i].is_read) unreadCount++;
        }
        
        var badge = document.getElementById('notificationBadge');
        var notifBtn = document.getElementById('notificationsBtn');
        
        if (unreadCount > 0) {
            if (badge) {
                badge.style.display = 'inline-flex';
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                if (unreadCount > lastNotificationCount && notifBtn) {
                    notifBtn.classList.add('has-notification');
                    setTimeout(function() { notifBtn.classList.remove('has-notification'); }, 500);
                }
            }
        } else {
            if (badge) badge.style.display = 'none';
        }
        
        lastNotificationCount = unreadCount;
        
        var notificationsList = document.getElementById('notificationsList');
        if (notificationsList && notificationsPanel && notificationsPanel.style.display === 'block') {
            if (notifications.length === 0) {
                notificationsList.innerHTML = '<div class="no-notifications">No notifications</div>';
            } else {
                var notifsHtml = '';
                for (var i = 0; i < notifications.length; i++) {
                    var n = notifications[i];
                    notifsHtml += `
                        <div class="notification-item ${!n.is_read ? 'unread' : ''}" data-id="${n.id}" onclick="markNotificationRead(${n.id})">
                            <div class="notification-title">${escapeHtml(n.title)}</div>
                            <div class="notification-message">${escapeHtml(n.message)}</div>
                            <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `;
                }
                notificationsList.innerHTML = notifsHtml;
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function markNotificationRead(notificationId) {
    try {
        await axios.post('/api/notifications/' + notificationId + '/read');
        await loadNotifications();
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ MAIN INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    
    // Initialize DOM elements
    initDOMElements();
    
    // Setup backup code listeners
    setupBackupCodeListeners();
    
    // Hide loading screen after a short delay to ensure everything is ready
    setTimeout(function() {
        hideLoadingScreen();
    }, 500);
    
    // Initialize all app functions
    setTimeout(function() {
        checkExistingLocation();
        loadTasks();
        loadNotifications();
        setupEventListeners();
        setupNavigation();
        setupTaskTypeSelector();
        loadUserProfile();
        startNotificationPolling();
        console.log('App fully initialized');
    }, 100);
});

// Expose globals
window.openTaskDetail = openTaskDetail;
window.applyForTask = applyForTask;
window.viewCandidates = viewCandidates;
window.selectCandidate = selectCandidate;
window.completeTask = completeTask;
window.markNotificationRead = markNotificationRead;
window.copyBackupCode = copyBackupCode;
window.downloadBackupCode = downloadBackupCode;
window.verifyWithBackup = verifyWithBackup;