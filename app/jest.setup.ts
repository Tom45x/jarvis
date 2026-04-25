import '@testing-library/jest-dom'

// jsdom implementiert scrollTo nicht — für Tests mocken
// (nur in jsdom-env, node-env hat kein window)
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollTo = jest.fn()
}
