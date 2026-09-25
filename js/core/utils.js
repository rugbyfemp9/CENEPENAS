function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function initials(name){
  return name.replace(' (tú)', '').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}
