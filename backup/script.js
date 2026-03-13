let kankanaeyData = []
let ibaloidata = []
let currentLang = 'kankanaey'
let currentMode = 'native'
let wordsLang     = 'kankanaey'
let wordsFiltered = []
let wordsSort     = { col: 'word', dir: 'asc' }
let wordsPage     = 1
const PAGE_SIZE   = 50
let activeAlpha   = null
let sortListenersAttached = false

Promise.all([
  fetch('kankanaey_dictionary.json').then(r => r.json()).catch(() => []),
  fetch('ibaloi_dictionary.json').then(r => r.json()).catch(() => [])
]).then(([kan, iba]) => {
  kankanaeyData = kan
  ibaloidata    = iba
  renderWordsPage()
})

function getEnglish(item){ return (item.english || '').trim() }
function activeDictionary(){ return currentLang === 'kankanaey' ? kankanaeyData : ibaloidata }
function wordsDict(){ return wordsLang === 'kankanaey' ? kankanaeyData : ibaloidata }

/* ── Page switching with smooth transition ── */
function showPage(pageId) {
  document.getElementById('navLinks').classList.remove('open')
  document.getElementById('hamburger').classList.remove('open')

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageId)
  })

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active')
    p.style.opacity = ''
    p.style.transform = ''
    p.style.display = ''
  })

  document.getElementById('page-' + pageId).classList.add('active')

  if(pageId === 'words') renderWordsPage()
}

/* ── Search ── */
function search(query){
  const q = query.trim().toLowerCase()
  if(!q) return []
  const dict = activeDictionary()
  if(currentMode === 'native') return dict.filter(item => (item.word||'').toLowerCase().includes(q))
  return dict.filter(item => getEnglish(item).toLowerCase().includes(q))
}

function highlight(text, query){
  if(!text||!query) return text||''
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

function buildCrossRefs(english, isKan) {
  const otherData  = isKan ? ibaloidata : kankanaeyData
  const otherLabel = isKan ? 'Ibaloi' : 'Kankanaey'

  const englishTerms = english.toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean)

  const seen = new Set()
  const matches = otherData.filter(other => {
    const otherEnglish = getEnglish(other).toLowerCase()
    const otherTerms   = otherEnglish.split(/[;,]/).map(s => s.trim()).filter(Boolean)
    const hasOverlap   = englishTerms.some(term =>
      otherTerms.some(ot => ot === term || ot.includes(term) || term.includes(ot))
    )
    if(hasOverlap && !seen.has(other.word)) {
      seen.add(other.word)
      return true
    }
    return false
  })

  if(!matches.length) return ''

  const crossCards = matches.slice(0, 3).map(m => {
    const mWord = m.word || ''
    const mPos  = m.part_of_speech || ''
    const mTag  = m.tagalog || ''
    return `<div class="cross-card">
      <span class="cross-lang">${otherLabel}</span>
      <span class="cross-word">${mWord}</span>
      ${mPos ? `<span class="cross-detail">${mPos}</span>` : ''}
      ${mTag ? `<span class="cross-detail">• ${mTag} (Tagalog)</span>` : ''}
    </div>`
  }).join('')

  return `<div class="cross-refs">
    <div class="cross-refs-title">Also in ${otherLabel}</div>
    ${crossCards}
  </div>`
}

function renderResults(results, query){
  const div = document.getElementById('result')
  if(!results.length){
    div.innerHTML = `<div class="no-result"><div class="nr-icon">📖</div><p>No results found for <strong>"${query}"</strong></p></div>`
    return
  }

  let html = `<div class="result-count"><span>${results.length}</span> result${results.length !== 1 ? 's' : ''} found</div>`

  results.forEach(item => {
    const word      = item.word || ''
    const english   = getEnglish(item)
    const tagalog   = item.tagalog || ''
    const pos       = item.part_of_speech || ''
    const isKan     = currentLang === 'kankanaey'
    const cardClass = isKan ? 'kankanaey-card' : 'ibaloi-card'
    const posClass  = isKan ? 'sage' : 'rust'
    const langLabel = isKan ? 'Kankanaey' : 'Ibaloi'

    const hlWord    = currentMode === 'native'  ? highlight(word, query)    : word
    const hlEnglish = currentMode === 'english' ? highlight(english, query) : english
    const crossHtml = buildCrossRefs(english, isKan)

    html += `<div class="result-card ${cardClass}">
      <div class="card-word">${hlWord}</div>
      ${pos ? `<span class="card-pos ${posClass}">${pos}</span>` : ''}
      <div class="card-fields">
        <div class="card-field"><span class="field-label">English</span><span>${hlEnglish}</span></div>
        ${tagalog ? `<div class="card-field"><span class="field-label">Tagalog</span><span>${tagalog}</span></div>` : ''}
        <div class="card-field"><span class="field-label">Language</span><span>${langLabel}</span></div>
      </div>
      ${crossHtml}
    </div>`
  })

  div.innerHTML = html
}

function showSuggestions(query){
  const sugDiv = document.getElementById('suggestions')
  if(!query){ sugDiv.classList.add('hidden'); return }
  const matches = search(query).slice(0, 6)
  if(!matches.length){ sugDiv.classList.add('hidden'); return }
  sugDiv.innerHTML = matches.map(item => {
    const word    = item.word || ''
    const english = getEnglish(item)
    const hlWord    = currentMode === 'native'  ? highlight(word, query)    : word
    const hlEnglish = currentMode === 'english' ? highlight(english, query) : english
    return `<div class="suggestion-item"
      data-word="${word.replace(/"/g,'&quot;')}"
      data-english="${english.replace(/"/g,'&quot;')}">
      <span class="sug-word">${currentMode === 'native' ? hlWord : hlEnglish}</span>
      <span class="sug-english">${currentMode === 'native' ? english : word}</span>
    </div>`
  }).join('')
  sugDiv.classList.remove('hidden')
  sugDiv.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const val = currentMode === 'native' ? el.dataset.word : el.dataset.english
      document.getElementById('wordInput').value = val
      sugDiv.classList.add('hidden')
      doSearch(val)
    })
  })
}

function doSearch(queryOverride){
  const query = (queryOverride !== undefined
    ? queryOverride
    : document.getElementById('wordInput').value
  ).trim()
  document.getElementById('suggestions').classList.add('hidden')
  if(!query) return
  renderResults(search(query), query)
}

document.getElementById('searchBtn').addEventListener('click', () => doSearch())
document.getElementById('wordInput').addEventListener('keydown', e => { if(e.key === 'Enter') doSearch() })
document.getElementById('wordInput').addEventListener('input', e => showSuggestions(e.target.value))

document.querySelectorAll('.lang-tab[data-lang]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lang-tab[data-lang]').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentLang = tab.dataset.lang
    document.getElementById('result').innerHTML = ''
    document.getElementById('wordInput').value = ''
    document.getElementById('suggestions').classList.add('hidden')
  })
})

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentMode = tab.dataset.mode
    document.getElementById('result').innerHTML = ''
    document.getElementById('wordInput').value = ''
    document.getElementById('suggestions').classList.add('hidden')
    document.getElementById('wordInput').placeholder = currentMode === 'native'
      ? 'Type a native word…'
      : 'Type an English word…'
  })
})

/* ── Word List ── */
function posClass(pos){
  if(!pos) return 'pos-other'
  const p = pos.toLowerCase()
  if(p.includes('noun'))   return 'pos-noun'
  if(p.includes('verb'))   return 'pos-verb'
  if(p.includes('adj'))    return 'pos-adjective'
  if(p.includes('adv'))    return 'pos-adverb'
  return 'pos-other'
}

function buildAlpha(){
  const dict = wordsDict()
  const letters = [...new Set(dict.map(i => (i.word||'')[0].toUpperCase()).filter(Boolean))].sort()
  const container = document.getElementById('alphaScroll')
  container.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
    `<button class="alpha-btn ${letters.includes(l) ? '' : 'disabled'}" data-alpha="${l}">${l}</button>`
  ).join('')
  container.querySelectorAll('.alpha-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const letter = btn.dataset.alpha
      if(activeAlpha === letter){
        activeAlpha = null
        btn.classList.remove('active')
      } else {
        container.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        activeAlpha = letter
      }
      wordsPage = 1
      applyWordsFilter()
    })
  })
}

function applyWordsFilter(){
  const query = (document.getElementById('wordsFilter').value || '').trim().toLowerCase()
  const dict  = wordsDict()
  wordsFiltered = dict.filter(item => {
    const word    = (item.word || '').toLowerCase()
    const english = getEnglish(item).toLowerCase()
    const tagalog = (item.tagalog || '').toLowerCase()
    const matchesText  = !query || word.includes(query) || english.includes(query) || tagalog.includes(query)
    const matchesAlpha = !activeAlpha || (item.word||'')[0].toUpperCase() === activeAlpha
    return matchesText && matchesAlpha
  })
  wordsFiltered.sort((a, b) => {
    let va, vb
    if(wordsSort.col === 'english')             { va = getEnglish(a);        vb = getEnglish(b) }
    else if(wordsSort.col === 'part_of_speech') { va = a.part_of_speech||''; vb = b.part_of_speech||'' }
    else                                        { va = a.word||'';           vb = b.word||'' }
    va = va.toLowerCase(); vb = vb.toLowerCase()
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return wordsSort.dir === 'asc' ? cmp : -cmp
  })
  renderWordsTable()
  renderPagination()
  updateStats()
}

function renderWordsTable(){
  const start = (wordsPage - 1) * PAGE_SIZE
  const slice = wordsFiltered.slice(start, start + PAGE_SIZE)
  const query = (document.getElementById('wordsFilter').value || '').trim()
  const tbody = document.getElementById('wordsBody')

  if(!slice.length){
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No words found.</td></tr>`
    return
  }

  tbody.innerHTML = slice.map(item => {
    const word      = item.word || ''
    const english   = getEnglish(item)
    const tagalog   = item.tagalog || ''
    const pos       = item.part_of_speech || ''
    const hlWord    = query ? highlight(word, query)    : word
    const hlEnglish = query ? highlight(english, query) : english
    return `<tr>
      <td class="td-word">${hlWord}</td>
      <td class="td-english">${hlEnglish}</td>
      <td class="td-tagalog">${tagalog}</td>
      <td><span class="td-pos ${posClass(pos)}">${pos || '—'}</span></td>
    </tr>`
  }).join('')

  // attach click handler to each row
  tbody.querySelectorAll('tr').forEach((row, i) => {
    row.addEventListener('click', () => openWordModal(slice[i]))
  })
}

function renderPagination(){
  const total = Math.ceil(wordsFiltered.length / PAGE_SIZE)
  const pg    = document.getElementById('pagination')
  if(total <= 1){ pg.innerHTML = ''; return }
  let html = `<button class="pg-btn" onclick="goPage(${wordsPage-1})" ${wordsPage===1?'disabled':''}>‹</button>`
  const pages = []
  for(let i = 1; i <= total; i++){
    if(i===1 || i===total || (i >= wordsPage-2 && i <= wordsPage+2)) pages.push(i)
    else if(pages[pages.length-1] !== '…') pages.push('…')
  }
  pages.forEach(p => {
    if(p === '…') html += `<span class="pg-ellipsis">…</span>`
    else html += `<button class="pg-btn ${p===wordsPage?'active':''}" onclick="goPage(${p})">${p}</button>`
  })
  html += `<button class="pg-btn" onclick="goPage(${wordsPage+1})" ${wordsPage===total?'disabled':''}>›</button>`
  html += `<span class="pg-info">Page ${wordsPage} of ${total}</span>`
  pg.innerHTML = html
}

function goPage(p){
  const total = Math.ceil(wordsFiltered.length / PAGE_SIZE)
  if(p < 1 || p > total) return
  wordsPage = p
  renderWordsTable()
  renderPagination()
  document.querySelector('.words-table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function updateStats(){
  const total = wordsDict().length
  const shown = wordsFiltered.length
  document.getElementById('wordsStats').innerHTML =
    `Showing <strong>${shown.toLocaleString()}</strong> of <strong>${total.toLocaleString()}</strong> entries`
}

function renderWordsPage(){
  buildAlpha()
  applyWordsFilter()
  // guard so sort listeners are only ever attached once
  if(!sortListenersAttached){
    document.querySelectorAll('.words-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col
        if(wordsSort.col === col) wordsSort.dir = wordsSort.dir === 'asc' ? 'desc' : 'asc'
        else { wordsSort.col = col; wordsSort.dir = 'asc' }
        document.querySelectorAll('.words-table th.sortable').forEach(h => h.classList.remove('sort-asc','sort-desc'))
        th.classList.add(wordsSort.dir === 'asc' ? 'sort-asc' : 'sort-desc')
        wordsPage = 1
        applyWordsFilter()
      })
    })
    sortListenersAttached = true
  }
}

document.querySelectorAll('.lang-tab[data-wlang]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lang-tab[data-wlang]').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    wordsLang   = tab.dataset.wlang
    wordsPage   = 1
    activeAlpha = null
    document.getElementById('wordsFilter').value = ''
    renderWordsPage()
  })
})

document.getElementById('wordsFilter').addEventListener('input', () => {
  wordsPage   = 1
  activeAlpha = null
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'))
  applyWordsFilter()
})

/* ── Hamburger ── */
const hamburger = document.getElementById('hamburger')
const navLinks  = document.getElementById('navLinks')
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open')
  hamburger.classList.toggle('open')
})

/* ── Nav links ── */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault()
    showPage(link.dataset.page)
  })
})

/* ── Word Modal ── */
function openWordModal(item) {
  const isKan     = wordsLang === 'kankanaey'
  const word      = item.word || ''
  const english   = getEnglish(item)
  const tagalog   = item.tagalog || ''
  const pos       = item.part_of_speech || ''
  const cardClass = isKan ? 'kankanaey-card' : 'ibaloi-card'
  const posClass  = isKan ? 'sage' : 'rust'
  const langLabel = isKan ? 'Kankanaey' : 'Ibaloi'
  const crossHtml = buildCrossRefs(english, isKan)

  document.getElementById('modalContent').innerHTML = `
    <div class="result-card ${cardClass}">
      <div class="card-word">${word}</div>
      ${pos ? `<span class="card-pos ${posClass}">${pos}</span>` : ''}
      <div class="card-fields">
        <div class="card-field"><span class="field-label">English</span><span>${english}</span></div>
        ${tagalog ? `<div class="card-field"><span class="field-label">Tagalog</span><span>${tagalog}</span></div>` : ''}
        <div class="card-field"><span class="field-label">Language</span><span>${langLabel}</span></div>
      </div>
      ${crossHtml}
    </div>`

  document.getElementById('wordModal').classList.add('open')
  document.body.style.overflow = 'hidden'
}

function closeWordModal() {
  document.getElementById('wordModal').classList.remove('open')
  document.body.style.overflow = ''
}

document.getElementById('wordModal').addEventListener('click', e => {
  if(e.target === document.getElementById('wordModal')) closeWordModal()
})

document.getElementById('modalClose').addEventListener('click', closeWordModal)

document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeWordModal()
})