const express = require("express");

const app = express();
app.use(express.json());

const path = require("path");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

let database = null;

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertStateObjectToRespondObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
app.post(`/login/`, async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `

SELECT 
*
FROM 
user
WHERE 
username ="${username}";`;

  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 1

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStateQuery = `
SELECT
*
FROM
state
ORDER BY
state_id;`;

  const stateArray = await database.all(getAllStateQuery);
  response.send(
    stateArray.map((eachState) => convertStateObjectToRespondObject(eachState))
  );
});

//API 2

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `
SELECT
*
FROM
state
WHERE
state_id = ${stateId};`;

  const state = await database.get(getStateQuery);
  response.send(convertStateObjectToRespondObject(state));
});

//API 3

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
INSERT INTO
district(district_name,state_id,cases,cured,active,deaths)
VALUES
('${districtName}','${stateId}','${cases}',${cured},'${active}','${deaths}');`;

  await database.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 4
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
SELECT * 
FROM 
district
WHERE 
district_id = ${districtId};`;

    const district = await database.get(getDistrictQuery);

    if (district) {
      response.send(convertDistrictDbObjectToResponseObject(district));
    } else {
      response.status(404).send("District not found");
    }
  }
);

//API 5

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrictQuery = `
DELETE FROM
district
WHERE
district_id = ${districtId};`;

    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const districtDetails = request.body;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updatedDistrictQuery = `
UPDATE
district
SET 
district_name= "${districtName}",
state_id = "${stateId}",
cases = "${cases}",
cured = "${cured}",
active = "${active}",
deaths = "${deaths}"

WHERE 
district_id = ${districtId};`;

    await database.run(updatedDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 7

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getDistrictStateQuery = `
SELECT
SUM(cases) as totalCases,
SUM(cured) as totalCured,
SUM(active) as totalActive, 
SUM(deaths) as totalDeaths
FROM
district 
WHERE
state_id = ${stateId};`;

    const stateStats = await database.get(getDistrictStateQuery); // Change this line

    response.send(stateStats);
  }
);

//API 8

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictIdQuery = `

SELECT
state_id

FROM
district

WHERE 
district_id = ${districtId};`;

    const getDistrictIdQueryResponse = await database.get(getDistrictIdQuery);

    const getStateNameQuery = `

SELECT 
state_name as stateName

FROM 
state

WHERE 
state_id = ${getDistrictIdQueryResponse.state_id};`;

    const getStateNameQueryResponse = await database.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
);

module.exports = app;
