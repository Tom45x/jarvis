import '@testing-library/jest-dom'

// jsdom implementiert scrollTo nicht — für Tests mocken
window.HTMLElement.prototype.scrollTo = jest.fn()
