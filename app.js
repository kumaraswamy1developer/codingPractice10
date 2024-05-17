const express = require('express')

const path = require('path')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const {open} = require('sqlite')

const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

let db = null

module.exports = app

const intializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

intializeDBAndServer()

const logger = (request, response, next) => {
  console.log(request.query)
  next()
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'abcdef', async (error, payload) => {
      if (error) {
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//Login API1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'abcdef')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET State list API2
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`
  const statesList = await db.all(getStatesQuery)
  const statesArray = state => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    }
  }

  const states = statesList.map(eachState => statesArray(eachState))
  response.send(states)
})

//GET State API3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getState = `SELECT * FROM state WHERE state_id=${stateId};`
  const state = await db.get(getState)
  const {state_id, state_name, population} = state
  response.send({
    stateId: state_id,
    stateName: state_name,
    population: population,
  })
})

//Add District API4
app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const addDistrict = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  await db.run(addDistrict)
  response.send('District Successfully Added')
})

//Get District APJI5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId};`
    const district = await db.get(getDistrict)
    const {district_id, district_name, state_id, cases, cured, active, deaths} =
      district
    response.send({
      districtId: district_id,
      districtName: district_name,
      stateId: state_id,
      cases: cases,
      cured: cured,
      active: active,
      deaths: deaths,
    })
  },
)

//Delete District API6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//Update District Details API7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const updateDistrictQuery = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths};`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

//Get statistics API8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getCasesQuery = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths) FROM district WHERE state_id=${stateId};`
    const caseDetails = await db.get(getCasesQuery)
    response.send({
      totalCases: caseDetails['SUM(cases)'],
      totalCured: caseDetails['SUM(cured)'],
      totalActive: caseDetails['SUM(active)'],
      totalDeaths: caseDetails['SUM(deaths)'],
    })
  },
)
