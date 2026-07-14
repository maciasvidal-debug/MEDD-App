// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrollToFirstError } from './_shared'

// scrollToFirstError is react-hook-form's onInvalid handler: on a failed step
// submit it must bring the FIRST error (in DOM order) into view, so a surveyor
// who tapped "Siguiente" isn't left with an off-screen error and no feedback.
describe('scrollToFirstError', () => {
  let scrollSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // jsdom has no layout engine, so scrollIntoView is undefined — stub it.
    scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    // Deterministic rAF: run the callback synchronously.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('scrolls the first [role="alert"] into view', () => {
    document.body.innerHTML = `
      <p role="alert" id="first">Campo obligatorio</p>
      <p role="alert" id="second">Otro error</p>
    `
    scrollToFirstError()
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    // Called on the first alert node, not the second.
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('first'))
  })

  it('is a no-op when there are no errors on screen', () => {
    document.body.innerHTML = `<p>Todo correcto</p>`
    scrollToFirstError()
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
