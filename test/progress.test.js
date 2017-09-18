const requester = require('../src/index')
const {progress, observable} = require('../src/middleware')
const {baseUrl, testNode, testNonIE, expect} = require('./helpers')

describe('progress', () => {
  it('should be able to use progress middleware without side-effects', done => {
    const request = requester([baseUrl, progress()])
    const req = request({url: '/plain-text'})

    req.error.subscribe(err => done(new Error(`error channel should not be called, got:\n\n${err.message}`)))
    req.response.subscribe(() => done())
  })

  testNonIE('should emit download progress events', function (done) {
    this.timeout(10000)

    const request = requester([baseUrl, progress()])
    const req = request({url: '/drip'})
    let events = 0

    req.progress.subscribe(evt => {
      events++
      expect(evt).to.containSubset({
        stage: 'download',
        lengthComputable: true
      })
    })

    req.error.subscribe(err => done(new Error(`error channel should not be called, got:\n\n${err.message}`)))
    req.response.subscribe(() => {
      expect(events).to.be.above(0)
      done()
    })
  })

  testNode('[node] should emit upload progress events on strings', done => {
    const request = requester([baseUrl, progress()])
    const req = request({url: '/plain-text', body: (new Array(100)).join('-')})
    let events = 0

    req.progress.subscribe(evt => {
      if (evt.stage !== 'upload') {
        return
      }

      events++
      expect(evt).to.containSubset({
        stage: 'upload',
        lengthComputable: true
      })
    })

    req.error.subscribe(err => done(new Error(`error channel should not be called, got:\n\n${err.message}`)))
    req.response.subscribe(() => {
      expect(events).to.be.above(0)
      done()
    })
  })

  testNode('[node] can tell requester how large the body is', done => {
    // This is flakey on node 6, works on all other versions though.
    const nodeVersion = parseInt(process.version.replace(/^v/, ''), 10)
    if (nodeVersion === 6) {
      done()
      return
    }

    const fs = require('fs')
    const request = requester([baseUrl, progress()])
    const body = fs.createReadStream(__filename)
    const bodySize = fs.statSync(__filename).size // eslint-disable-line no-sync
    const req = request({url: '/plain-text', body, bodySize})
    let events = 0

    req.progress.subscribe(evt => {
      if (evt.stage !== 'upload') {
        return
      }

      events++
      expect(evt).to.containSubset({
        stage: 'upload',
        lengthComputable: true
      })
    })

    req.error.subscribe(err => done(new Error(`error channel should not be called, got:\n\n${err.message}`)))
    req.response.subscribe(() => {
      expect(events).to.be.above(0, 'should have received progress events')
      done()
    })
  })

  testNonIE('progress events should be emitted on observable', function (done) {
    this.timeout(10000)

    const implementation = require('zen-observable')
    const request = requester([baseUrl, progress(), observable({implementation})])
    const obs = request({url: '/drip'})
      .filter(ev => ev.type === 'progress')
      .subscribe(evt => {
        expect(evt).to.containSubset({
          stage: 'download',
          lengthComputable: true
        })

        obs.unsubscribe()
        done()
      })
  })
})
