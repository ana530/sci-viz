import React from 'react'
import renderer from 'react-test-renderer'

import Footer from '../Components/Footer/Footer.tsx'

beforeAll(() => {
    process.env = Object.assign(process.env, { NODE_ICU_DATA: 'node_modules/full-icu' })
})

global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({ version: '2.0.0' })
    })
)

it('Snapshot of Footer component', () => {
    const tree = renderer.create(<Footer />).toJSON()
    expect(tree).toMatchSnapshot()
})
