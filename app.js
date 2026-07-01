const STORAGE_KEY = 'ansaOrdersV1';
const DELIVERY_MS = 24 * 60 * 60 * 1000;

let orders = loadOrders();
let currentCompleteOrder = null;
let pendingOrder = null;

const routes = {
  home: document.getElementById('homeView'),
  confirm: document.getElementById('confirmView'),
  complete: document.getElementById('completeView'),
  orders: document.getElementById('ordersView'),
  report: document.getElementById('reportView'),
};

const form = document.getElementById('fakeOrderForm');
const formError = document.getElementById('formError');
const categoryChips = document.getElementById('categoryChips');
const desireChips = document.getElementById('desireChips');

function loadOrders() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return saved.map(migrateOrder);
  } catch {
    return [];
  }
}

function migrateOrder(order) {
  const createdAt = order.createdAt || new Date().toISOString();
  return {
    ...order,
    createdAt,
    fakeDeliveredAt: order.fakeDeliveredAt || new Date(new Date(createdAt).getTime() + DELIVERY_MS).toISOString(),
    confirmedAt: order.confirmedAt || null,
    confirmedBeforeDelivery: Boolean(order.confirmedBeforeDelivery),
    reviewCreatedAt: order.reviewCreatedAt || null,
  };
}

function saveOrders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  renderAll();
}

function formatWon(value) {
  const num = Number(value) || 0;
  return `${num.toLocaleString('ko-KR')}원`;
}

function parsePrice(value) {
  return Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
}

function formatPriceInputValue(value) {
  const numericValue = String(value || '').replace(/[^0-9]/g, '');
  if (!numericValue) return '';
  return Number(numericValue).toLocaleString('ko-KR');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatEta(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeLeftText(targetDateString) {
  const diff = new Date(targetDateString).getTime() - Date.now();
  if (diff <= 0) return '도착 완료';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)));
  if (hours >= 1) return `약 ${hours}시간 ${minutes}분 남음`;
  return `약 ${minutes}분 남음`;
}

function ymd(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function generateOrderNo() {
  const today = ymd();
  const countToday = orders.filter(order => order.orderNo?.includes(`ANSA-${today}`)).length + 1;
  return `ANSA-${today}-${String(countToday).padStart(4, '0')}`;
}

function uniqueId() {
  return `ansa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSelected(container) {
  return container.querySelector('.chip.selected')?.dataset.value || '';
}

function setupChipGroup(container) {
  container.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach(item => item.classList.remove('selected', 'warm'));
    chip.classList.add('selected');
    if (container.id === 'desireChips' && ['꽤 사고 싶음', '진짜 사고 싶음', '지금 당장 사고 싶음'].includes(chip.dataset.value)) {
      chip.classList.add('warm');
    }
  });
}

function getDeliveryInfo(order) {
  const created = new Date(order.createdAt).getTime();
  const delivered = new Date(order.fakeDeliveredAt || created + DELIVERY_MS).getTime();
  const now = Date.now();
  const elapsed = now - created;
  const total = Math.max(delivered - created, DELIVERY_MS);
  const progress = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));

  let status = '주문 확인중';
  let step = 0;
  let message = '가짜 주문이 접수됐어요. 마음이 조금 식는지 지켜볼게요.';

  if (now >= delivered) {
    status = '배송완료';
    step = 4;
    message = '가짜 상품이 도착했어요. 구매확정하고 마음 리뷰를 남길 수 있어요.';
  } else if (elapsed >= 12 * 60 * 60 * 1000) {
    status = '배송중';
    step = 3;
    message = '가짜 상품이 오고 있어요. 기다리는 동안 마음을 식혀볼까요?';
  } else if (elapsed >= 3 * 60 * 60 * 1000) {
    status = '출고 완료';
    step = 2;
    message = '가짜 상품이 출고된 척하고 있어요. 아직 돈은 그대로예요.';
  } else if (elapsed >= 10 * 60 * 1000) {
    status = '상품 준비중';
    step = 1;
    message = '상품을 준비하는 척하는 중이에요. 실제 결제와 배송은 없어요.';
  }

  return {
    status,
    step,
    progress,
    deliveredAtText: formatEta(order.fakeDeliveredAt || new Date(created + DELIVERY_MS).toISOString()),
    leftText: timeLeftText(order.fakeDeliveredAt || new Date(created + DELIVERY_MS).toISOString()),
    message,
    isDelivered: status === '배송완료',
  };
}

function navigate(route) {
  Object.entries(routes).forEach(([key, view]) => view.classList.toggle('active', key === route));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === route));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

document.body.addEventListener('click', event => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) navigate(routeButton.dataset.route);
});

setupChipGroup(categoryChips);
setupChipGroup(desireChips);

const priceInput = document.getElementById('price');
priceInput.addEventListener('input', event => {
  const formatted = formatPriceInputValue(event.target.value);
  event.target.value = formatted;
});

form.addEventListener('submit', event => {
  event.preventDefault();
  formError.textContent = '';
  const productName = document.getElementById('productName').value.trim();
  const price = parsePrice(document.getElementById('price').value);
  const shopName = document.getElementById('shopName').value.trim() || '미입력';
  const category = getSelected(categoryChips) || '기타';
  const initialDesire = getSelected(desireChips) || '꽤 사고 싶음';
  const reason = document.getElementById('reason').value.trim();

  if (!productName) {
    formError.textContent = '상품명을 입력해주세요.';
    document.getElementById('productName').focus();
    return;
  }
  if (!price) {
    formError.textContent = '가격을 입력해주세요.';
    document.getElementById('price').focus();
    return;
  }

  const createdAt = new Date();
  pendingOrder = {
    id: uniqueId(),
    orderNo: generateOrderNo(),
    productName,
    price,
    shopName,
    category,
    reason,
    createdAt: createdAt.toISOString(),
    fakeDeliveredAt: new Date(createdAt.getTime() + DELIVERY_MS).toISOString(),
    initialDesire,
    confirmedAt: null,
    confirmedBeforeDelivery: false,
    afterDeliveryScore: null,
    review: '',
    reviewCreatedAt: null,
    finalDecision: null,
  };
  renderConfirm(pendingOrder);
  navigate('confirm');
});

document.getElementById('confirmPayButton').addEventListener('click', () => {
  if (!pendingOrder) {
    navigate('home');
    return;
  }
  const order = pendingOrder;
  orders.unshift(order);
  currentCompleteOrder = order;
  pendingOrder = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  resetFakeOrderForm();
  renderComplete(order);
  navigate('complete');
});

document.getElementById('editOrderButton').addEventListener('click', () => {
  navigate('home');
});

function resetFakeOrderForm() {
  form.reset();
  categoryChips.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected'));
  categoryChips.querySelector('[data-value="전자기기"]').classList.add('selected');
  desireChips.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected', 'warm'));
  const defaultDesire = desireChips.querySelector('[data-value="꽤 사고 싶음"]');
  defaultDesire.classList.add('selected', 'warm');
}

function renderConfirm(order) {
  if (!order) return;
  document.getElementById('confirmOrderDetails').innerHTML = `
    <div><span>상품명</span><strong>${escapeHtml(order.productName)}</strong></div>
    <div><span>주문금액</span><strong>${formatWon(order.price)}</strong></div>
    <div><span>쇼핑몰명</span><strong>${escapeHtml(order.shopName)}</strong></div>
    <div><span>카테고리</span><strong>${escapeHtml(order.category)}</strong></div>
    <div><span>지금 구매욕구</span><strong>${escapeHtml(order.initialDesire)}</strong></div>
    <div><span>구매 이유</span><strong>${escapeHtml(order.reason || '미입력')}</strong></div>
    <div><span>가짜 배송 예정</span><strong>${formatEta(order.fakeDeliveredAt)} 도착 예정</strong></div>
  `;
}

function renderComplete(order) {
  if (!order) return;
  const delivery = getDeliveryInfo(order);
  document.getElementById('completeSaved').textContent = formatWon(order.price);
  document.getElementById('completeDetails').innerHTML = `
    <div><span>주문번호</span><strong>${order.orderNo}</strong></div>
    <div><span>상품명</span><strong>${escapeHtml(order.productName)}</strong></div>
    <div><span>결제금액</span><strong>${formatWon(order.price)}</strong></div>
    <div><span>쇼핑몰명</span><strong>${escapeHtml(order.shopName)}</strong></div>
    <div><span>주문일시</span><strong>${formatDate(order.createdAt)}</strong></div>
    <div><span>가짜 배송상태</span><strong>${delivery.status} · ${delivery.leftText}</strong></div>
  `;
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function isThisMonth(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function calculateStats() {
  const confirmed = orders.filter(order => order.finalDecision === '안 사도 됨');
  const monthConfirmed = confirmed.filter(order => isThisMonth(order.createdAt));
  const pending = orders.filter(order => order.finalDecision === '조금 더 고민');
  const buy = orders.filter(order => order.finalDecision === '진짜 구매 후보');
  const earlyConfirmed = orders.filter(order => order.confirmedBeforeDelivery).length;
  const reviewed = orders.filter(order => order.reviewCreatedAt).length;
  const totalConfirmed = confirmed.reduce((sum, order) => sum + order.price, 0);
  const monthConfirmedAmount = monthConfirmed.reduce((sum, order) => sum + order.price, 0);
  const categoryMap = confirmed.reduce((map, order) => {
    map[order.category] = (map[order.category] || 0) + order.price;
    return map;
  }, {});
  return { confirmed, monthConfirmed, pending, buy, earlyConfirmed, reviewed, totalConfirmed, monthConfirmedAmount, categoryMap };
}

function renderHomeStats() {
  const stats = calculateStats();
  document.getElementById('homeMonthSaved').textContent = formatWon(stats.monthConfirmedAmount);
  document.getElementById('homeSummary').textContent = `가짜 결제 ${orders.length}회 · 안 산 물건 ${stats.confirmed.length}개`;
}

function renderDeliveryTimeline(order) {
  const delivery = getDeliveryInfo(order);
  const steps = ['주문 확인', '상품 준비', '출고 완료', '배송중', '배송완료'];
  return `
    <div class="delivery-sim">
      <div class="delivery-head">
        <div>
          <strong>${delivery.status}</strong>
          <span>${delivery.message}</span>
        </div>
        <em>${delivery.leftText}</em>
      </div>
      <div class="delivery-track" aria-label="가짜 배송 진행률">
        <i style="width:${delivery.progress}%"></i>
      </div>
      <div class="delivery-steps">
        ${steps.map((step, index) => `<span class="${index <= delivery.step ? 'done' : ''}">${step}</span>`).join('')}
      </div>
      <p class="delivery-note">예상 도착: ${delivery.deliveredAtText} · 실제 상품은 배송되지 않아요.</p>
    </div>
  `;
}

function renderOrders() {
  const list = document.getElementById('ordersList');
  list.innerHTML = '';
  if (!orders.length) {
    list.innerHTML = `<div class="empty-state card-strong"><strong>아직 가짜 주문이 없어요.</strong><span>첫 번째 마음 결제서를 작성해보세요.</span></div>`;
    return;
  }
  const template = document.getElementById('orderCardTemplate');
  orders.forEach(order => {
    const delivery = getDeliveryInfo(order);
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.order-card');
    card.dataset.id = order.id;
    node.querySelector('.category-tag').textContent = order.category;
    node.querySelector('h2').textContent = order.productName;
    node.querySelector('.meta').textContent = `${order.orderNo} · ${order.shopName} · ${formatDate(order.createdAt)}`;
    node.querySelector('.reason-text').textContent = order.reason ? `구매 이유: ${order.reason}` : '구매 이유: 아직 적지 않았어요.';
    node.querySelector('.price-text').textContent = formatWon(order.price);
    node.querySelector('.status-pill').textContent = `가짜 배송: ${delivery.status}`;
    node.querySelector('.desire-pill').textContent = `처음 마음: ${order.initialDesire}`;
    const decision = node.querySelector('.decision-pill');
    decision.textContent = `최종 판단: ${order.finalDecision || '아직 없음'}`;
    decision.classList.toggle('good', order.finalDecision === '안 사도 됨');
    decision.classList.toggle('hold', order.finalDecision === '조금 더 고민');
    decision.classList.toggle('buy', order.finalDecision === '진짜 구매 후보');

    const deliveryBox = node.querySelector('.delivery-box');
    deliveryBox.innerHTML = renderDeliveryTimeline(order);

    const actions = node.querySelector('.order-actions');
    if (!order.confirmedAt) {
      const confirmText = delivery.isDelivered ? '가짜 구매확정하기' : '도착 전 가짜 구매확정하기';
      actions.append(actionButton(confirmText, () => confirmFakePurchase(order.id), 'confirm-action'));
    } else {
      actions.append(actionButton(order.finalDecision ? '리뷰 수정하기' : '리뷰 작성하기', () => revealReviewPanel(order.id), 'review-action'));
    }
    actions.append(actionButton('삭제', () => deleteOrder(order.id), 'danger'));

    const confirmNote = node.querySelector('.confirm-note');
    if (order.confirmedAt) {
      confirmNote.textContent = order.confirmedBeforeDelivery
        ? `구매확정 완료 · 배송완료 전 마음이 먼저 정리됐어요. (${formatDate(order.confirmedAt)})`
        : `구매확정 완료 · 이제 마음 리뷰를 남길 수 있어요. (${formatDate(order.confirmedAt)})`;
      confirmNote.classList.remove('hidden');
    } else if (!delivery.isDelivered) {
      confirmNote.textContent = '아직 도착 전이어도 마음이 정리됐다면 가짜 구매확정하고 리뷰를 남길 수 있어요.';
      confirmNote.classList.remove('hidden');
    } else {
      confirmNote.textContent = '가짜 상품이 도착했어요. 구매확정하고 마음을 확인해볼까요?';
      confirmNote.classList.remove('hidden');
    }

    const panel = node.querySelector('.review-panel');
    if (order.confirmedAt && !order.finalDecision) panel.classList.remove('hidden');
    node.querySelector('.score-select').value = order.afterDeliveryScore || '';
    node.querySelector('.review-input').value = order.review || '';
    node.querySelector('.decision-select').value = order.finalDecision || '';
    node.querySelector('.save-review').addEventListener('click', () => {
      const currentCard = document.querySelector(`.order-card[data-id="${order.id}"]`);
      const finalDecision = currentCard.querySelector('.decision-select').value || null;
      if (!finalDecision) {
        alert('최종 판단을 선택해주세요.');
        return;
      }
      updateOrder(order.id, {
        afterDeliveryScore: currentCard.querySelector('.score-select').value || null,
        review: currentCard.querySelector('.review-input').value.trim(),
        finalDecision,
        reviewCreatedAt: new Date().toISOString(),
      });
    });
    list.appendChild(node);
  });
}

function actionButton(text, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (className) button.classList.add(className);
  button.addEventListener('click', onClick);
  return button;
}

function confirmFakePurchase(id) {
  const order = orders.find(item => item.id === id);
  if (!order) return;
  const delivery = getDeliveryInfo(order);
  const message = delivery.isDelivered
    ? '가짜 상품을 받아본 걸로 하고 구매확정할까요?\n\n이제 마음 리뷰를 남기고, 진짜로 필요한 물건인지 확인할 수 있어요.'
    : '아직 배송완료 전이에요.\n\n그래도 마음이 정리됐다면 가짜 구매확정하고 리뷰를 남길 수 있어요. 진행할까요?';
  if (!confirm(message)) return;
  updateOrder(id, {
    confirmedAt: new Date().toISOString(),
    confirmedBeforeDelivery: !delivery.isDelivered,
  });
}

function revealReviewPanel(id) {
  const panel = document.querySelector(`.order-card[data-id="${id}"] .review-panel`);
  if (panel) panel.classList.remove('hidden');
}

function updateOrder(id, patch) {
  orders = orders.map(order => order.id === id ? migrateOrder({ ...order, ...patch }) : order);
  saveOrders();
}

function deleteOrder(id) {
  if (!confirm('이 가짜 주문을 삭제할까요?')) return;
  orders = orders.filter(order => order.id !== id);
  saveOrders();
}

function renderReport() {
  const stats = calculateStats();
  const cards = [
    ['이번 달 확정 절약금액', formatWon(stats.monthConfirmedAmount), 'primary'],
    ['전체 확정 절약금액', formatWon(stats.totalConfirmed), 'primary'],
    ['가짜 결제 횟수', `${orders.length}회`, ''],
    ['안 사도 된 상품', `${stats.confirmed.length}개`, ''],
    ['고민 중인 상품', `${stats.pending.length}개`, ''],
    ['진짜 구매 후보', `${stats.buy.length}개`, ''],
    ['도착 전 구매확정', `${stats.earlyConfirmed}개`, ''],
    ['리뷰 작성 완료', `${stats.reviewed}개`, ''],
  ];
  document.getElementById('reportCards').innerHTML = cards.map(([label, value, type]) => `
    <article class="report-card card-strong ${type}"><p>${label}</p><strong>${value}</strong></article>
  `).join('');

  const categoryReport = document.getElementById('categoryReport');
  const entries = Object.entries(stats.categoryMap).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    categoryReport.innerHTML = '<p class="meta">최종 판단이 “안 사도 됨”인 상품이 생기면 여기에 카테고리별 절약금액이 표시돼요.</p>';
  } else {
    categoryReport.innerHTML = `<div class="category-list">${entries.map(([category, amount]) => `
      <div class="category-row"><span>${category}</span><strong>${formatWon(amount)}</strong></div>
    `).join('')}</div>`;
  }
}

function renderAll() {
  renderHomeStats();
  renderOrders();
  renderReport();
  if (pendingOrder) renderConfirm(pendingOrder);
  if (currentCompleteOrder) renderComplete(currentCompleteOrder);
}

renderAll();
setInterval(renderAll, 60 * 1000);
