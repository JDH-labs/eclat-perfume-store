const fragranceData = {
  'amber-noir': {
    name: 'AMBER NOIR',
    image: 'assets/perfumes/amber-noir.png',
    prices: { 50: 18000, 100: 32000 },
    color: '#d97832',
    accent: '#c99a61',
    description: 'Тёплая амбра и сухие породы дерева соединяются с бархатной ванилью и пряным розовым перцем.',
    top: ['Розовый перец', 'Шафран', 'Корица'],
    heart: ['Амбра', 'Кедр', 'Ваниль'],
    base: ['Сандал', 'Тёплая древесина', 'Мускус']
  },
  'velvet-bloom': {
    name: 'VELVET BLOOM',
    image: 'assets/perfumes/velvet-bloom.png',
    prices: { 50: 17000, 100: 30000 },
    color: '#dca985',
    accent: '#f2d4c2',
    description: 'Шёлковая роза и прозрачный жасмин обрамляют пышный пион, оставляя на коже облако мягкого мускуса.',
    top: ['Пион', 'Лепестки розы'],
    heart: ['Роза', 'Жасмин', 'Пион'],
    base: ['Мягкий мускус', 'Белый мускус', 'Лепестки цветов']
  },
  'citrus-ombre': {
    name: 'CITRUS OMBRE',
    image: 'assets/perfumes/citrus-ombre.png',
    prices: { 50: 16000, 100: 28000 },
    color: '#d8a24a',
    accent: '#f7d77f',
    description: 'Искристый бергамот и лимон раскрываются солнечным нероли, а сухой ветивер оставляет чистый зелёный шлейф.',
    top: ['Бергамот', 'Лимон'],
    heart: ['Нероли', 'Бергамот', 'Лимонная цедра'],
    base: ['Ветивер', 'Корень ветивера', 'Цитрусовая свежесть']
  },
  'midnight-oud': {
    name: 'MIDNIGHT OUD',
    image: 'assets/perfumes/midnight-oud.png',
    prices: { 50: 21000, 100: 38000 },
    color: '#8d6d49',
    accent: '#b9a686',
    description: 'Тёмный уд и пряный шафран переплетены с мягкой кожей, землистым пачули и тёплым сандалом.',
    top: ['Шафран', 'Уд'],
    heart: ['Уд', 'Кожа', 'Пачули'],
    base: ['Сандал', 'Пачули', 'Кожа']
  }
};

const cart = [];
const cartPanel = document.getElementById('cartPanel');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const sprayButton = document.getElementById('sprayButton');
const sprayStatus = document.getElementById('sprayStatus');
const capToggle = document.getElementById('capToggle');
const bottleHost = document.getElementById('fragranceBottle');
const fragranceCards = document.querySelectorAll('.fragrance-card');
const viewButtons = document.querySelectorAll('.view-btn');
const addToCartButtons = document.querySelectorAll('.add-cart');
const cartToggle = document.querySelector('.cart-toggle');
const closeCart = document.querySelector('.close-cart');
const shopLayout = document.querySelector('.shop-layout');
let sprayStatusTimer = 0;
let capWaitFrame = 0;
let sprayRequestId = 0;

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0
});

function initLenis() {
  if (window.Lenis && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      touchMultiplier: 1.1
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }
}

function initGsap() {
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { gsap } = window;
  gsap.registerPlugin(window.ScrollTrigger);

  gsap.from('.hero-copy, .hero-visual', {
    opacity: 0,
    y: 50,
    duration: 1.2,
    stagger: 0.15,
    ease: 'power3.out'
  });

  gsap.from('.fragrance-card', {
    opacity: 0,
    y: 30,
    duration: 0.9,
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.collection',
      start: 'top 80%',
      once: true
    }
  });

  gsap.from('.note-group', {
    opacity: 0,
    y: 24,
    duration: 0.8,
    stagger: 0.1,
    scrollTrigger: {
      trigger: '.composition-stage',
      start: 'top 78%',
      once: true
    }
  });

  gsap.from('.shop-card', {
    opacity: 0,
    y: 24,
    duration: 0.8,
    stagger: 0.1,
    scrollTrigger: {
      trigger: '.shop-grid',
      start: 'top 82%',
      once: true
    }
  });

  gsap.to('.bottle-scene', {
    yPercent: -10,
    scale: 1.06,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });

  gsap.to('.mist-one', {
    x: 30,
    y: 20,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });

  gsap.to('.mist-two', {
    x: -28,
    y: -18,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });
}

function initEditorialReveals() {
  const targets = document.querySelectorAll('.editorial-reveal');
  if (!targets.length || !('IntersectionObserver' in window)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      entry.target.classList.remove('reveal-pending');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  targets.forEach((target) => {
    target.classList.add('reveal-pending');
    observer.observe(target);
  });
}

function initQuietSceneParallax() {
  const scene = document.querySelector('.philosophy-quiet-visual');
  if (!scene
    || !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  scene.addEventListener('pointermove', (event) => {
    const bounds = scene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty('--quiet-pointer-x', `${(x * 18).toFixed(1)}px`);
    scene.style.setProperty('--quiet-pointer-y', `${(y * 14).toFixed(1)}px`);
  });
  scene.addEventListener('pointerleave', () => {
    scene.style.setProperty('--quiet-pointer-x', '0px');
    scene.style.setProperty('--quiet-pointer-y', '0px');
  });
}

function updateComposition(fragranceKey) {
  const perfume = fragranceData[fragranceKey];
  if (!perfume) return;

  const bottle = document.getElementById('compositionBottle');
  const heroBottle = document.getElementById('heroBottleImage');
  const heroBottleHost = document.getElementById('fragranceBottle');
  const philosophyBottleHosts = document.querySelectorAll('.philosophy-bottle');
  const compositionStage = document.querySelector('.stage-visual');
  const ingredientStages = document.querySelectorAll('.ingredient-stage[data-fragrance]');
  const heroGlow = document.querySelector('.bottle .glow');
  const nameEl = document.getElementById('compositionName');
  const topNotesEl = document.getElementById('topNotes');
  const heartNotesEl = document.getElementById('heartNotes');
  const baseNotesEl = document.getElementById('baseNotes');
  const ingredientDescription = document.getElementById('ingredientDescription');
  const ingredientTopNotes = document.getElementById('ingredientTopNotes');
  const ingredientHeartNotes = document.getElementById('ingredientHeartNotes');
  const ingredientBaseNotes = document.getElementById('ingredientBaseNotes');

  document.documentElement.style.setProperty('--amber', perfume.color);
  document.documentElement.style.setProperty('--gold', perfume.accent);
  heroBottleHost.dataset.capOpen = 'false';
  heroBottleHost.dispatchEvent(new CustomEvent('capchange'));
  setCapToggleState(false);

  nameEl.textContent = perfume.name;
  topNotesEl.innerHTML = perfume.top.map((item) => `<li>${item}</li>`).join('');
  heartNotesEl.innerHTML = perfume.heart.map((item) => `<li>${item}</li>`).join('');
  baseNotesEl.innerHTML = perfume.base.map((item) => `<li>${item}</li>`).join('');
  ingredientDescription.textContent = perfume.description;
  ingredientTopNotes.innerHTML = perfume.top.map((item) => `<li>${item}</li>`).join('');
  ingredientHeartNotes.innerHTML = perfume.heart.map((item) => `<li>${item}</li>`).join('');
  ingredientBaseNotes.innerHTML = perfume.base.map((item) => `<li>${item}</li>`).join('');

  bottle.src = perfume.image;
  bottle.alt = `Флакон аромата ${perfume.name}`;
  compositionStage.dataset.fragrance = fragranceKey;
  bottle.style.filter = `drop-shadow(0 28px 42px ${perfume.color}55)`;
  heroBottle.src = perfume.image;
  heroBottle.alt = `Стеклянный флакон ÉCLAT ${perfume.name}`;
  heroBottleHost.dataset.fragrance = fragranceKey;
  heroBottleHost.dispatchEvent(new CustomEvent('bottlechange'));
  philosophyBottleHosts.forEach((philosophyBottleHost) => {
    const philosophyBottleImage = philosophyBottleHost.querySelector('img');
    philosophyBottleHost.dataset.fragrance = fragranceKey;
    if (philosophyBottleImage) {
      philosophyBottleImage.src = perfume.image;
      philosophyBottleImage.alt = `Флакон ÉCLAT ${perfume.name} в тёплом свете`;
    }
    philosophyBottleHost.dispatchEvent(new CustomEvent('bottlechange'));
  });
  const quietVisualName = document.querySelector('.quiet-visual-name');
  if (quietVisualName) quietVisualName.textContent = perfume.name;
  compositionStage.dispatchEvent(new CustomEvent('bottlechange'));
  ingredientStages.forEach((stage) => {
    stage.dataset.fragrance = fragranceKey;
    const fallback = stage.querySelector('.ingredient-fallback');
    if (fallback) {
      fallback.src = perfume.image;
      fallback.alt = `Статичное изображение флакона ${perfume.name}; интерактивная 3D-композиция загружается отдельно`;
    }
    stage.dispatchEvent(new CustomEvent('ingredientchange'));
  });

  if (heroGlow) {
    heroGlow.style.background = `radial-gradient(circle, ${perfume.color}88, ${perfume.color}44 28%, transparent 68%)`;
  }
}

function updateProductPrices() {
  document.querySelectorAll('.fragrance-card[data-fragrance]').forEach((card) => {
    const perfume = fragranceData[card.dataset.fragrance];
    const price = card.querySelector('.collection-price');
    if (perfume && price) price.textContent = `от ${currency.format(perfume.prices[50])} · 50 мл`;
  });

  document.querySelectorAll('.shop-card[data-id]').forEach((card) => {
    const perfume = fragranceData[card.dataset.id];
    const volumeSelect = card.querySelector('select');
    const price = card.querySelector('.shop-price');
    if (!perfume || !volumeSelect || !price) return;

    const updatePrice = () => {
      const selectedPrice = perfume.prices[volumeSelect.value];
      if (selectedPrice === undefined) {
        console.error(`ÉCLAT ${card.dataset.id} has no price for ${volumeSelect.value} ml.`);
        return;
      }
      card.dataset.price = String(selectedPrice);
      price.textContent = currency.format(selectedPrice);
    };

    volumeSelect.addEventListener('change', updatePrice);
    updatePrice();
  });
}

function bindFragranceSelection() {
  fragranceCards.forEach((card) => {
    const activate = () => {
      fragranceCards.forEach((item) => item.classList.toggle('active', item === card));
      updateComposition(card.dataset.fragrance);
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });

    card.querySelector('.view-btn')?.addEventListener('click', (event) => {
      event.stopPropagation();
      activate();
      document.getElementById('composition').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setCapToggleState(open) {
  capToggle.setAttribute('aria-pressed', String(open));
  capToggle.setAttribute('aria-label', open ? 'Закрыть крышку флакона' : 'Открыть крышку флакона');
  capToggle.querySelector('.cap-toggle-label').textContent = open ? 'Закрыть крышку' : 'Открыть крышку';
}

function setupCapToggle() {
  const bottleHost = document.getElementById('fragranceBottle');
  capToggle.addEventListener('click', () => {
    const open = capToggle.getAttribute('aria-pressed') !== 'true';
    bottleHost.dataset.capOpen = String(open);
    setCapToggleState(open);
    bottleHost.dispatchEvent(new CustomEvent('capchange'));
  });
  bottleHost.addEventListener('capstatechange', (event) => {
    setCapToggleState(event.detail.open);
  });
}

function calculateCart() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 18 : 0;
  const total = subtotal + shipping;

  subtotalEl.textContent = currency.format(subtotal);
  shippingEl.textContent = currency.format(shipping);
  totalEl.textContent = currency.format(total);
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function setCartOpen(isOpen) {
  cartPanel.classList.toggle('open', isOpen);
  shopLayout.classList.toggle('cart-open', isOpen);
  cartToggle.setAttribute('aria-expanded', String(isOpen));
}

function renderCart() {
  if (!cart.length) {
    cartItems.innerHTML = '<p class="empty-cart">Корзина пуста. Добавьте аромат, чтобы начать свой ритуал.</p>';
    calculateCart();
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item) => `
        <div class="cart-item" data-id="${item.id}" data-volume="${item.volume}">
          <img class="cart-mini" src="${item.image}" alt="Флакон ${item.name}" />
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <span>${item.volume} ml</span>
            <div class="cart-item-qty">
              <button type="button" data-action="decrease" aria-label="Уменьшить количество">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" aria-label="Увеличить количество">+</button>
            </div>
          </div>
          <div class="cart-item-price">
            <strong>${currency.format(item.price * item.quantity)}</strong>
            <button type="button" class="remove-item" data-action="remove">Удалить</button>
          </div>
        </div>
      `
    )
    .join('');

  document.querySelectorAll('[data-action="increase"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const itemElement = event.currentTarget.closest('.cart-item');
      const item = cart.find((entry) => entry.id === itemElement.dataset.id && entry.volume === itemElement.dataset.volume);
      if (!item) return;
      item.quantity += 1;
      renderCart();
    });
  });

  document.querySelectorAll('[data-action="decrease"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const itemElement = event.currentTarget.closest('.cart-item');
      const item = cart.find((entry) => entry.id === itemElement.dataset.id && entry.volume === itemElement.dataset.volume);
      if (!item) return;
      if (item.quantity <= 1) {
        const index = cart.findIndex((entry) => entry.id === item.id && entry.volume === item.volume);
        if (index >= 0) cart.splice(index, 1);
      } else {
        item.quantity -= 1;
      }
      renderCart();
    });
  });

  document.querySelectorAll('[data-action="remove"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const itemElement = event.currentTarget.closest('.cart-item');
      const index = cart.findIndex((entry) => entry.id === itemElement.dataset.id && entry.volume === itemElement.dataset.volume);
      if (index >= 0) cart.splice(index, 1);
      renderCart();
    });
  });

  calculateCart();
}

function addToCart(productCard) {
  const productId = productCard.dataset.id;
  const name = productCard.dataset.name;
  const volume = productCard.querySelector('select').value;
  const price = fragranceData[productId]?.prices[volume];
  const tint = productCard.dataset.tint || '#d97832';
  const image = productCard.dataset.image;

  if (price === undefined) {
    console.error(`ÉCLAT ${productId} has no price for ${volume} ml.`);
    return;
  }

  const existing = cart.find((item) => item.id === productId && item.volume === volume);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: productId, name, price, volume, quantity: 1, tint, image });
  }

  renderCart();
  setCartOpen(true);
}

function setupCartInteractions() {
  cartToggle.addEventListener('click', () => {
    setCartOpen(true);
    cartPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  closeCart.addEventListener('click', () => {
    setCartOpen(false);
  });

  addToCartButtons.forEach((button) => {
    button.addEventListener('click', () => {
      addToCart(button.closest('.shop-card'));
    });
  });
}

function setSprayStatus(message) {
  sprayStatus.textContent = message;
  sprayStatus.classList.add('visible');
}

function resetSprayStatus() {
  sprayButton.classList.remove('pressed');
  sprayStatus.classList.remove('visible');
  sprayStatus.textContent = 'АРОМАТ ВЫПУЩЕН';
}

function requestSprayWhenCapIsOpen(requestId, startedAt) {
  if (requestId !== sprayRequestId) return;

  if (bottleHost.dataset.capOpen !== 'true') {
    resetSprayStatus();
    return;
  }

  const isReady = bottleHost.dataset['3dLoaded'] === 'true'
    && bottleHost.dataset.capSettled === 'true';
  if (isReady) {
    bottleHost.dispatchEvent(new Event('sprayrequest'));
    return;
  }

  if (performance.now() - startedAt > 5000) {
    console.error('ÉCLAT atomizer could not be opened; the spray was not started.');
    setSprayStatus('РАСПЫЛИТЕЛЬ НЕДОСТУПЕН');
    sprayStatusTimer = setTimeout(resetSprayStatus, 1800);
    return;
  }

  capWaitFrame = requestAnimationFrame(() => requestSprayWhenCapIsOpen(requestId, startedAt));
}

function triggerSpray() {
  sprayRequestId += 1;
  cancelAnimationFrame(capWaitFrame);
  clearTimeout(sprayStatusTimer);
  sprayButton.classList.add('pressed');

  if (bottleHost.dataset.capOpen !== 'true') {
    setSprayStatus('КРЫШКА ОТКРЫВАЕТСЯ');
    capToggle.click();
  } else {
    setSprayStatus('РАСПЫЛИТЕЛЬ ГОТОВИТСЯ');
  }

  requestSprayWhenCapIsOpen(sprayRequestId, performance.now());
}

function wireSprayButton() {
  sprayButton.addEventListener('click', triggerSpray);
  bottleHost.addEventListener('spraylaunched', () => {
    setSprayStatus('АРОМАТ ВЫПУЩЕН');
    clearTimeout(sprayStatusTimer);
    sprayStatusTimer = setTimeout(resetSprayStatus, 1200);
  });
  bottleHost.addEventListener('sprayblocked', () => {
    if (bottleHost.dataset.capOpen === 'true') {
      requestSprayWhenCapIsOpen(sprayRequestId, performance.now());
      return;
    }
    setSprayStatus('СНАЧАЛА ОТКРОЙТЕ КРЫШКУ');
    sprayStatusTimer = setTimeout(resetSprayStatus, 1400);
  });
  bottleHost.addEventListener('sprayerror', () => {
    setSprayStatus('РАСПЫЛИТЕЛЬ НЕДОСТУПЕН');
    sprayStatusTimer = setTimeout(resetSprayStatus, 1800);
  });
}

function setup() {
  initLenis();
  initGsap();
  initEditorialReveals();
  initQuietSceneParallax();
  bindFragranceSelection();
  updateProductPrices();
  setupCapToggle();
  setupCartInteractions();
  updateComposition('amber-noir');
  renderCart();
  wireSprayButton();
}

setup();
