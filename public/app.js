const state = {
  workerId: null,
  accessToken: null,
  worker: null,
  dashboard: null,
};

const authPanel = document.getElementById('authPanel');
const dashboardPanel = document.getElementById('dashboardPanel');
const otpBox = document.getElementById('otpBox');

const phoneInput = document.getElementById('phoneInput');
const otpInput = document.getElementById('otpInput');

const pendingWages = document.getElementById('pendingWages');
const safetyStatus = document.getElementById('safetyStatus');
const openCases = document.getElementById('openCases');
const wageList = document.getElementById('wageList');

function setAuthView(isLoggedIn) {
  authPanel.classList.toggle('hidden', isLoggedIn);
  dashboardPanel.classList.toggle('hidden', !isLoggedIn);
}

function showDashboard(data) {
  state.worker = data.worker;
  state.dashboard = data;

  const totalPending = (data.wageEntries || []).reduce((sum, item) => {
    return sum + (Number(item.amount || 0) - Number(item.deductions || 0));
  }, 0);

  const latestCheckIn = (data.checkIns || []).at(-1);
  const openCount = (data.cases || []).filter((entry) => entry.status !== 'resolved').length;

  pendingWages.textContent = `₹${totalPending}`;
  safetyStatus.textContent = latestCheckIn ? latestCheckIn.status : 'Safe';
  openCases.textContent = String(openCount);

  document.getElementById('employerInput').value = state.worker.profile.employer || '';
  document.getElementById('worksiteInput').value = state.worker.profile.worksite || '';
  document.getElementById('originInput').value = state.worker.profile.origin || '';
  document.getElementById('wagePromiseInput').value = state.worker.profile.wagePromise || '';
  document.getElementById('payFrequencyInput').value = state.worker.profile.payFrequency || 'monthly';

  wageList.innerHTML = '';
  (data.wageEntries || []).forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `${entry.type} — ₹${entry.amount} | deduction ₹${entry.deductions} | on ${new Date(entry.date).toLocaleDateString()}`;
    wageList.appendChild(item);
  });
}

async function requestOtp() {
  const phone = phoneInput.value.trim();
  if (!phone) return;

  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Unable to send OTP.');
    return;
  }

  state.workerId = data.workerId;
  otpBox.classList.remove('hidden');
  alert('Demo OTP: 123456');
}

async function verifyOtp() {
  const phone = phoneInput.value.trim();
  const otp = otpInput.value.trim();

  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Verification failed.');
    return;
  }

  state.accessToken = data.accessToken;
  state.workerId = data.user.id;
  setAuthView(true);
  await loadDashboard();
}

async function loadDashboard() {
  if (!state.workerId) return;

  const response = await fetch(`/api/workers/${state.workerId}`);
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Unable to load dashboard.');
    return;
  }

  showDashboard(data);
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.workerId) return;

  const profile = {
    employer: document.getElementById('employerInput').value,
    worksite: document.getElementById('worksiteInput').value,
    origin: document.getElementById('originInput').value,
    wagePromise: Number(document.getElementById('wagePromiseInput').value || 0),
    payFrequency: document.getElementById('payFrequencyInput').value,
  };

  const response = await fetch('/api/worker/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: state.workerId, profile }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Profile update failed.');
    return;
  }

  await loadDashboard();
}

async function submitCheckIn(event) {
  event.preventDefault();
  if (!state.workerId) return;

  const payload = {
    workerId: state.workerId,
    status: document.getElementById('safetyStatusInput').value,
    hazard: document.getElementById('hazardInput').value,
    notes: document.getElementById('checkinNotes').value,
    locationConsent: true,
    location: 'demo-location',
  };

  const response = await fetch('/api/check-ins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Check-in failed.');
    return;
  }

  await loadDashboard();
  document.getElementById('checkinForm').reset();
}

async function addWageEntry(event) {
  event.preventDefault();
  if (!state.workerId) return;

  const payload = {
    workerId: state.workerId,
    type: 'received',
    amount: Number(document.getElementById('wageAmountInput').value || 0),
    deductions: Number(document.getElementById('deductionInput').value || 0),
    overtime: Number(document.getElementById('overtimeInput').value || 0),
  };

  const response = await fetch('/api/wage-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Wage entry failed.');
    return;
  }

  await loadDashboard();
  document.getElementById('wageForm').reset();
}

async function fileComplaint(event) {
  event.preventDefault();
  if (!state.workerId) return;

  const payload = {
    workerId: state.workerId,
    type: document.getElementById('caseTypeInput').value,
    priority: document.getElementById('casePriorityInput').value,
    summary: document.getElementById('caseSummaryInput').value,
  };

  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Complaint filing failed.');
    return;
  }

  await loadDashboard();
  document.getElementById('caseForm').reset();
  alert('Complaint filed successfully.');
}

function logout() {
  state.workerId = null;
  state.accessToken = null;
  state.worker = null;
  state.dashboard = null;
  setAuthView(false);
  phoneInput.value = '';
  otpInput.value = '';
  otpBox.classList.add('hidden');
}

document.getElementById('otpBtn').addEventListener('click', requestOtp);
document.getElementById('verifyBtn').addEventListener('click', verifyOtp);
document.getElementById('profileForm').addEventListener('submit', saveProfile);
document.getElementById('checkinForm').addEventListener('submit', submitCheckIn);
document.getElementById('wageForm').addEventListener('submit', addWageEntry);
document.getElementById('caseForm').addEventListener('submit', fileComplaint);
document.getElementById('logoutBtn').addEventListener('click', logout);

setAuthView(false);
