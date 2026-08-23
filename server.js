import express from "express";
import fs from "fs";
import path from "path";
import session from "express-session";
import pg from "pg";
import { fileURLToPath } from "url";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 3000;

const DATA = path.join(__dirname, "data.json");


// ======================================================
// POSTGRESQL
// ======================================================

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL
    })
    : null;


// ======================================================
// FALLBACK DATA
// ======================================================

const fallbackData = {
    league: {
        name: "ABATERA LEAGUE",
        season: "Season 2026",
        pointsWin: 3,
        pointsDraw: 1
    },

    teams: [],

    players: [],

    matches: []
};


// ======================================================
// LOAD ORIGINAL DATA.JSON
// ======================================================

function loadLocalData() {

    if (!fs.existsSync(DATA)) {

        fs.writeFileSync(
            DATA,
            JSON.stringify(
                fallbackData,
                null,
                2
            )
        );

    }

    return JSON.parse(
        fs.readFileSync(
            DATA,
            "utf8"
        )
    );

}


// ======================================================
// INITIALIZE DATABASE
// ======================================================

async function initDatabase() {

    if (!pool) {

        console.log(
            "DATABASE_URL not found. Using data.json locally."
        );

        return;

    }


    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY,
            data JSONB NOT NULL
        )
    `);


    const result =
        await pool.query(
            "SELECT id FROM app_state WHERE id = 1"
        );


    // First time only:
    // import your current data.json into PostgreSQL

    if (result.rowCount === 0) {

        const currentData =
            loadLocalData();


        await pool.query(
            `
            INSERT INTO app_state (id, data)
            VALUES (1, $1::jsonb)
            `,
            [
                JSON.stringify(
                    currentData
                )
            ]
        );


        console.log(
            "ABATERA data imported into PostgreSQL."
        );

    }


    console.log(
        "PostgreSQL connected successfully."
    );

}


// ======================================================
// READ DATA
// ======================================================

async function readData() {

    // Online / Railway

    if (pool) {

        const result =
            await pool.query(
                "SELECT data FROM app_state WHERE id = 1"
            );


        if (
            result.rows.length > 0
        ) {

            return result.rows[0].data;

        }

    }


    // Local fallback

    return loadLocalData();

}


// ======================================================
// WRITE DATA
// ======================================================

async function writeData(data) {

    // PostgreSQL

    if (pool) {

        await pool.query(
            `
            INSERT INTO app_state (id, data)
            VALUES (1, $1::jsonb)

            ON CONFLICT (id)
            DO UPDATE SET data = EXCLUDED.data
            `,
            [
                JSON.stringify(
                    data
                )
            ]
        );


        return;

    }


    // Local fallback

    fs.writeFileSync(
        DATA,
        JSON.stringify(
            data,
            null,
            2
        )
    );

}


// ======================================================
// EXPRESS
// ======================================================

app.use(
    express.json()
);


app.use(
    session({

        secret:
            process.env.SESSION_SECRET
            || "change-this-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            sameSite: "lax",

            secure:
                process.env.NODE_ENV
                === "production",

            maxAge:
                1000
                * 60
                * 60
                * 12

        }

    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ======================================================
// ADMIN LOGIN
// ======================================================

app.post(
    "/api/login",

    (req, res) => {

        const {
            username,
            password
        } = req.body;


        const adminUser =
            process.env.ADMIN_USER;


        const adminPassword =
            process.env.ADMIN_PASSWORD;


        if (
            username === adminUser
            &&
            password === adminPassword
        ) {

            req.session.isAdmin = true;


            return res.json({
                ok: true
            });

        }


        return res
            .status(401)
            .json({

                error:
                    "Wrong username or password."

            });

    }
);


// ======================================================
// LOGOUT
// ======================================================

app.post(
    "/api/logout",

    (req, res) => {

        req.session.destroy(() => {

            res.json({
                ok: true
            });

        });

    }
);


// ======================================================
// ADMIN STATUS
// ======================================================

app.get(
    "/api/admin-status",

    (req, res) => {

        res.json({

            loggedIn:
                req.session.isAdmin
                === true

        });

    }
);


// ======================================================
// ADMIN SECURITY
// ======================================================

function requireAdmin(
    req,
    res,
    next
) {

    if (
        req.session.isAdmin
    ) {

        return next();

    }


    return res
        .status(401)
        .json({

            error:
                "Admin login required."

        });

}


// ======================================================
// GET LEAGUE DATA
// ======================================================

app.get(
    "/api/data",

    async (req, res) => {

        try {

            const data =
                await readData();


            res.json(
                data
            );

        }

        catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Could not load league data."

                });

        }

    }
);


// ======================================================
// ADD MATCH
// ======================================================

app.post(
    "/api/matches",

    requireAdmin,

    async (req, res) => {

        try {

            const data =
                await readData();


            const match = {
                ...req.body
            };


            if (
                !match.homeTeamId
                ||
                !match.awayTeamId
                ||
                match.homeTeamId
                === match.awayTeamId
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Choose two different teams."

                    });

            }


            match.homeGoals =
                Number(
                    match.homeGoals
                );


            match.awayGoals =
                Number(
                    match.awayGoals
                );


            if (
                !Number.isInteger(
                    match.homeGoals
                )
                ||
                !Number.isInteger(
                    match.awayGoals
                )
                ||
                match.homeGoals < 0
                ||
                match.awayGoals < 0
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Invalid score."

                    });

            }


            match.id =
                "m" + Date.now();


            match.date =
                match.date
                ||
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    );


            match.scorers =
                Array.isArray(
                    match.scorers
                )
                    ? match.scorers
                    : [];


            match.assists =
                Array.isArray(
                    match.assists
                )
                    ? match.assists
                    : [];


            match.cleanSheetPlayerId =
                match.cleanSheetPlayerId
                || null;


            match.mvpPlayerId =
                match.mvpPlayerId
                || null;


            match.cards =
                Array.isArray(
                    match.cards
                )
                    ? match.cards
                    : [];


            data.matches =
                Array.isArray(
                    data.matches
                )
                    ? data.matches
                    : [];


            data.matches.unshift(
                match
            );


            await writeData(
                data
            );


            res.json(
                match
            );

        }

        catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Could not save match."

                });

        }

    }
);


// ======================================================
// DELETE MATCH
// ======================================================

app.delete(
    "/api/matches/:id",

    requireAdmin,

    async (req, res) => {

        try {

            const data =
                await readData();


            data.matches =
                data.matches.filter(

                    (match) =>
                        match.id
                        !== req.params.id

                );


            await writeData(
                data
            );


            res.json({
                ok: true
            });

        }

        catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Could not delete match."

                });

        }

    }
);


// ======================================================
// ADD TEAM
// ======================================================

app.post(
    "/api/teams",

    requireAdmin,

    async (req, res) => {

        try {

            const data =
                await readData();


            const name =
                String(
                    req.body.name
                    || ""
                ).trim();


            if (!name) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Team name required."

                    });

            }


            const newTeam = {

                id:
                    "t"
                    + Date.now(),

                name,

                short:
                    (
                        name
                            .replace(
                                /[^A-Za-z]/g,
                                ""
                            )
                            .slice(
                                0,
                                3
                            )
                        || "TM"
                    )
                    .toUpperCase()

            };


            data.teams.push(
                newTeam
            );


            await writeData(
                data
            );


            res.json(
                newTeam
            );

        }

        catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Could not add team."

                });

        }

    }
);


// ======================================================
// ADD PLAYER
// ======================================================

app.post(
    "/api/players",

    requireAdmin,

    async (req, res) => {

        try {

            const data =
                await readData();


            const name =
                String(
                    req.body.name
                    || ""
                ).trim();


            const teamId =
                req.body.teamId;


            if (
                !name
                ||
                !data.teams.some(

                    (team) =>
                        team.id
                        === teamId

                )
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "Name and valid team required."

                    });

            }


            const newPlayer = {

                id:
                    "p"
                    + Date.now(),

                name,

                teamId,

                position:
                    req.body.position
                    || ""

            };


            data.players.push(
                newPlayer
            );


            await writeData(
                data
            );


            res.json(
                newPlayer
            );

        }

        catch (error) {

            console.error(
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "Could not add player."

                });

        }

    }
);


// ======================================================
// WEBSITE
// ======================================================

app.get(
    "*splat",

    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// ======================================================
// START
// ======================================================

async function startServer() {

    try {

        await initDatabase();


        app.listen(
            PORT,

            () => {

                console.log(
                    `ABATERA LEAGUE running on port ${PORT}`
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Server startup failed:",
            error
        );


        process.exit(1);

    }

}


startServer();