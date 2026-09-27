function initials(name){
  return name.replace(' (tú)', '').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}
