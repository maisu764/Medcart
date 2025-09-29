/* script.js - combined cart + checkout + orders
   Uses keys:
     "medcart"        -> current cart array [{id, name, price, qty, img}]
     "medcart_orders" -> orders array
*/

// ---------- helper / storage ----------
function getCart(){ try { return JSON.parse(localStorage.getItem('medcart')) || []; } catch(e){ return []; } }
function saveCart(cart){ localStorage.setItem('medcart', JSON.stringify(cart)); updateCartCount(); }
function getOrders(){ try { return JSON.parse(localStorage.getItem('medcart_orders')) || []; } catch(e){ return []; } }
function saveOrders(orders){ localStorage.setItem('medcart_orders', JSON.stringify(orders)); }
function slugify(text){ return text.toString().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

// ---------- UI: cart count ----------
function updateCartCount(){
  const cart = getCart();
  const totalQty = cart.reduce((s,i)=> s + (i.qty || 0), 0);
  const el = document.getElementById('cart-count');
  if(el) el.textContent = totalQty;
}
document.addEventListener('DOMContentLoaded', updateCartCount);

// ---------- add to cart (used on product pages) ----------
function addToCartItem(name, price, img){
  const cart = getCart();
  const id = slugify(name);
  const found = cart.find(i => i.id === id);
  if(found){
    found.qty = (found.qty||1) + 1;
  } else {
    cart.push({ id, name, price: Number(price), qty: 1, img: img || '' });
  }
  saveCart(cart);
  updateCartCount();
}

// helper to bind existing buttons (if pages use class .add-to-cart)
function bindAddToCartButtons(){
  document.querySelectorAll('.add-to-cart').forEach(btn=>{
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const price = Number(btn.dataset.price) || 0;
      const img = btn.dataset.img || '';
      addToCartItem(name,price,img);
      alert(`${name} added to cart`);
    });
  });
}
document.addEventListener('DOMContentLoaded', bindAddToCartButtons);

// ---------- cart page rendering ----------
function renderCartTable(tableBodySelector){
  const cart = getCart();
  const tbody = document.querySelector(tableBodySelector);
  const totalEl = document.getElementById('cart-total'); // total element in cart.html
  if(!tbody) return;
  tbody.innerHTML = '';
  if(cart.length === 0){
    tbody.innerHTML = '<tr><td colspan="5">Your cart is empty</td></tr>';
    if(totalEl) totalEl.textContent = "Total: Rs 0";
    updateCartCount();
    return;
  }
  
  let subtotal = 0;
  cart.forEach(item => {
    const tr = document.createElement('tr');
    const lineTotal = item.price * item.qty;
    subtotal += lineTotal;
    tr.innerHTML = `
      <td style="display:flex;align-items:center;gap:10px;">
        ${item.img ? `<img src="${item.img}" style="width:48px;height:48px;object-fit:cover" alt="">` : ''}
        <div>${item.name}</div>
      </td>
      <td>Rs ${item.price}</td>
      <td><input type="number" class="qty-input" data-id="${item.id}" value="${item.qty}" min="1" style="width:70px;padding:6px"></td>
      <td>Rs ${lineTotal}</td>
      <td><button class="remove-item" data-id="${item.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  // show total
  if(totalEl) totalEl.textContent = "Total: Rs " + subtotal;

  // bind qty change and remove
  document.querySelectorAll('.qty-input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id = e.target.dataset.id;
      let q = parseInt(e.target.value) || 1;
      if(q < 1) q = 1;
      updateQuantity(id, q);
      renderCartTable(tableBodySelector);
    });
  });
  document.querySelectorAll('.remove-item').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      removeFromCart(e.target.dataset.id);
      renderCartTable(tableBodySelector);
    });
  });

  updateCartCount();
}

function updateQuantity(id, qty){
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === id);
  if(idx >= 0){ cart[idx].qty = qty; saveCart(cart); }
}
function removeFromCart(id){
  let cart = getCart();
  cart = cart.filter(i => i.id !== id);
  saveCart(cart);
}
function clearCart(){
  localStorage.removeItem('medcart');
  updateCartCount();
}

// If cart page exists, render it and bind clear/checkout
document.addEventListener('DOMContentLoaded', () => {
  if(document.querySelector('#cart-table tbody')) {
    renderCartTable('#cart-table tbody');
    const clearBtn = document.getElementById('clear-cart');
    if(clearBtn) clearBtn.addEventListener('click', ()=>{ if(confirm('Clear cart?')){ clearCart(); renderCartTable('#cart-table tbody'); }});
    const checkoutBtn = document.getElementById('checkout');
    if(checkoutBtn) checkoutBtn.addEventListener('click', ()=> window.location.href = 'checkout.html');
  }
});

// ---------- CHECKOUT helpers (used on checkout.html) ----------
function computeCartTotals(deliveryMethod){
  const cart = getCart();
  const subtotal = cart.reduce((s,i)=> s + i.price * i.qty, 0);
  let deliveryFee = 0;
  if(deliveryMethod === 'express') deliveryFee = 150;
  return { cart, subtotal, deliveryFee, total: subtotal + deliveryFee };
}

// Renders the summary on checkout page
function renderCheckoutSummary(){
  const summaryItemsEl = document.getElementById('summary-items');
  const subEl = document.getElementById('summary-subtotal');
  const delEl = document.getElementById('summary-delivery');
  const totalEl = document.getElementById('summary-total');
  if(!summaryItemsEl) return;
  const deliveryMethod = document.getElementById('delivery-method') ? document.getElementById('delivery-method').value : 'standard';
  const { cart, subtotal, deliveryFee, total } = computeCartTotals(deliveryMethod);
  summaryItemsEl.innerHTML = '';
  if(cart.length === 0) summaryItemsEl.innerHTML = '<div>Your cart is empty.</div>';
  cart.forEach(it => {
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `<div>${it.name} x ${it.qty}</div><div>Rs ${it.price * it.qty}</div>`;
    summaryItemsEl.appendChild(row);
  });
  if(subEl) subEl.textContent = subtotal;
  if(delEl) delEl.textContent = deliveryFee;
  if(totalEl) totalEl.textContent = total;
}

// placeOrder(customer) --> validates and returns { success:true, orderId } or {success:false, message}
function placeOrder(customer){
  if(!customer || !customer.name || !customer.phone || !customer.address || !customer.city){
    return { success:false, message: 'Please fill required fields: name, phone, address, city.' };
  }
  const deliveryMethod = customer.delivery || 'standard';
  const { cart, subtotal, deliveryFee, total } = computeCartTotals(deliveryMethod);
  if(!cart || cart.length === 0) return { success:false, message: 'Cart is empty.' };

  const id = 'ORD' + Date.now().toString(36);
  const order = {
    id,
    createdAt: new Date().toISOString(),
    items: cart.map(i => ({ id:i.id, name:i.name, price:i.price, qty:i.qty, img:i.img })),
    customer: {
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      postal: customer.postal || '',
      notes: customer.notes || '',
      payment: customer.payment || 'cod',
      delivery: deliveryMethod
    },
    subtotal,
    deliveryFee,
    total,
    status: 'pending'
  };

  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  clearCart();
  return { success:true, orderId: id };
}

// expose some functions globally
window.addToCartItem = addToCartItem;
window.renderCheckoutSummary = renderCheckoutSummary;
window.placeOrder = placeOrder;
window.getCart = getCart;
window.getOrders = getOrders;
window.updateCartCount = updateCartCount;
