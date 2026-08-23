let D = {};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function esc(x = "") {
    return String(x).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[m]));
}

function team(id) {
    return D.teams.find((x) => x.id === id) || {
        name: "Unknown",
        short: "?"
    };
}

function player(id) {
    return D.players.find((x) => x.id === id) || {
        name: "Unknown",
        teamId: ""
    };
}


// ======================================================
// NAVIGATION
// ======================================================

function showPage(id) {

    document
        .querySelectorAll(".page")
        .forEach((page) => {

            page.classList.toggle(
                "active",
                page.id === id
            );

        });


    document
        .querySelectorAll("nav button")
        .forEach((button) => {

            button.classList.toggle(
                "active",
                button.dataset.page === id
            );

        });


    if (id === "admin") {

        checkAdmin();

    }


    window.scrollTo(0, 0);
}


$$("nav button").forEach((button) => {

    button.addEventListener("click", () => {

        showPage(button.dataset.page);

    });

});


// ======================================================
// LOAD DATA
// ======================================================

async function load() {

    try {

        const response = await fetch("/api/data");

        if (!response.ok) {
            throw new Error("Could not load league data.");
        }

        D = await response.json();

        if (!D.teams) D.teams = [];
        if (!D.players) D.players = [];
        if (!D.matches) D.matches = [];

        render();

    } catch (error) {

        console.error("MARBALL load error:", error);

    }

}


// ======================================================
// PLAYER STATISTICS
// ======================================================

function stats() {

    const s = {};

    D.players.forEach((p) => {

        s[p.id] = {
            ...p,

            goals: 0,
            assists: 0,
            cs: 0,
            mvp: 0,

            yellow: 0,
            red: 0
        };

    });


    D.matches.forEach((m) => {

        // GOALS

        (m.scorers || []).forEach((playerId) => {

            if (s[playerId]) {
                s[playerId].goals++;
            }

        });


        // ASSISTS

        (m.assists || []).forEach((playerId) => {

            if (s[playerId]) {
                s[playerId].assists++;
            }

        });


        // CLEAN SHEET

        if (
            m.cleanSheetPlayerId &&
            s[m.cleanSheetPlayerId]
        ) {

            s[m.cleanSheetPlayerId].cs++;

        }


        // MVP

        if (
            m.mvpPlayerId &&
            s[m.mvpPlayerId]
        ) {

            s[m.mvpPlayerId].mvp++;

        }


        // CARDS

        (m.cards || []).forEach((card) => {

            if (!s[card.playerId]) {
                return;
            }

            if (card.type === "yellow") {

                s[card.playerId].yellow++;

            } else if (card.type === "red") {

                s[card.playerId].red++;

            }

        });

    });


    return Object.values(s).map((x) => ({

        ...x,

        teamName: team(x.teamId).name

    }));

}


// ======================================================
// LEAGUE TABLE
// ======================================================

function leagueTable() {

    const table = D.teams.map((t) => ({

        team: t,

        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,

        gf: 0,
        ga: 0,

        points: 0

    }));


    D.matches.forEach((match) => {

        const home = table.find(
            (x) => x.team.id === match.homeTeamId
        );

        const away = table.find(
            (x) => x.team.id === match.awayTeamId
        );


        if (!home || !away) {
            return;
        }


        const homeGoals = Number(match.homeGoals || 0);
        const awayGoals = Number(match.awayGoals || 0);


        home.played++;
        away.played++;


        home.gf += homeGoals;
        home.ga += awayGoals;

        away.gf += awayGoals;
        away.ga += homeGoals;


        // HOME WIN

        if (homeGoals > awayGoals) {

            home.wins++;
            home.points += 3;

            away.losses++;

        }

        // AWAY WIN

        else if (homeGoals < awayGoals) {

            away.wins++;
            away.points += 3;

            home.losses++;

        }

        // DRAW

        else {

            home.draws++;
            away.draws++;

            home.points++;
            away.points++;

        }

    });


    // SORT TABLE

    table.sort((a, b) => {

        // Points

        if (b.points !== a.points) {
            return b.points - a.points;
        }


        // Goal difference

        const gdA = a.gf - a.ga;
        const gdB = b.gf - b.ga;

        if (gdB !== gdA) {
            return gdB - gdA;
        }


        // Goals scored

        return b.gf - a.gf;

    });


    return table;

}


// ======================================================
// RANKINGS
// ======================================================

function ranking(players, statName) {

    return players

        .filter((p) => p[statName] > 0)

        .sort(
            (a, b) =>
                b[statName] - a[statName]
        );

}


// ======================================================
// EMPTY MESSAGE
// ======================================================

function empty() {

    return `
        <p class="details">
            No data yet.
        </p>
    `;

}


// ======================================================
// STAT ROW
// ======================================================

function statHTML(statName, icon) {

    return (p) => `

        <div class="statrow">

            <span>

                ${esc(p.name)}

                <small>
                    ${esc(p.teamName)}
                </small>

            </span>

            <b>
                ${icon} ${p[statName]}
            </b>

        </div>

    `;

}


// ======================================================
// MATCH HTML
// ======================================================

function matchHTML(match) {

    const home = team(match.homeTeamId);
    const away = team(match.awayTeamId);


    const scorers = (match.scorers || [])

        .map((id) => esc(player(id).name))

        .join(", ");


    const assists = (match.assists || [])

        .map((id) => esc(player(id).name))

        .join(", ");


    let extra = "";


    if (scorers) {

        extra += `

            <div class="details">
                ⚽ ${scorers}
            </div>

        `;

    }


    if (assists) {

        extra += `

            <div class="details">
                🎯 ${assists}
            </div>

        `;

    }


    if (match.cleanSheetPlayerId) {

        extra += `

            <div class="details">
                🧤 CS:
                ${esc(
                    player(match.cleanSheetPlayerId).name
                )}
            </div>

        `;

    }


    if (match.mvpPlayerId) {

        extra += `

            <div class="details">
                ⭐ MVP:
                ${esc(
                    player(match.mvpPlayerId).name
                )}
            </div>

        `;

    }


    return `

        <div class="match">

            <div class="team">

                <b>
                    ${esc(home.name)}
                </b>

            </div>


            <div>

                <div class="scorebig">

                    ${match.homeGoals}
                    —
                    ${match.awayGoals}

                </div>


                <div class="details">

                    ${esc(match.date || "")}

                </div>


                ${extra}

            </div>


            <div class="team">

                <b>
                    ${esc(away.name)}
                </b>

            </div>

        </div>

    `;

}


// ======================================================
// TEAMS PAGE
// ======================================================

function renderTeamsPage() {

    const container =
        document.querySelector("#teamsGrid");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (D.teams.length === 0) {

        container.innerHTML = `

            <div class="panel">

                <p class="details">
                    No teams yet.
                </p>

            </div>

        `;

        return;

    }


    D.teams.forEach((t) => {

        const teamPlayers =
            D.players.filter(
                (p) => p.teamId === t.id
            );


        const goalkeepers =
            teamPlayers.filter(
                (p) => p.position === "GK"
            );


        const fieldPlayers =
            teamPlayers.filter(
                (p) => p.position !== "GK"
            );


        const card =
            document.createElement("div");


        card.className =
            "panel teamCard";


        let playersHTML = "";


        if (teamPlayers.length === 0) {

            playersHTML = `

                <p class="details">

                    No players in this team yet.

                </p>

            `;

        }

        else {

            if (goalkeepers.length > 0) {

                playersHTML += `

                    <div class="details">
                        GOALKEEPERS
                    </div>

                `;


                playersHTML += goalkeepers

                    .map((p) => `

                        <span class="player">

                            🧤
                            ${esc(p.name)}
                            ·
                            ${esc(p.position)}

                        </span>

                    `)

                    .join("");

            }


            if (fieldPlayers.length > 0) {

                playersHTML += `

                    <div
                        class="details"
                        style="margin-top:15px;"
                    >

                        PLAYERS

                    </div>

                `;


                playersHTML += fieldPlayers

                    .map((p) => `

                        <span class="player">

                            ⚽
                            ${esc(p.name)}
                            ·
                            ${esc(p.position)}

                        </span>

                    `)

                    .join("");

            }

        }


card.innerHTML = `

    <div class="teamLogoBox">
        <img
            src="${esc(t.logo)}"
            alt="${esc(t.name)} logo"
            class="teamLogo"
        >
    </div>

    <div>

        <p class="eyebrow">
            TEAM
        </p>

        <h2>
            ${esc(t.name)}

            <small>
                ${esc(t.short || "")}
            </small>
        </h2>

    </div>

    <div class="details">

        ${teamPlayers.length}
        PLAYER${teamPlayers.length === 1 ? "" : "S"}

    </div>

    <div
        class="playersList"
        style="margin-top:20px;"
    >

        ${playersHTML}

    </div>


 `;
        

        container.appendChild(card);

    });

}


// ======================================================
// MAIN RENDER
// ======================================================

function render() {

    const table = leagueTable();

    const playerStats = stats();


    const topGoals =
        ranking(
            playerStats,
            "goals"
        );


    const topAssists =
        ranking(
            playerStats,
            "assists"
        );


    const topCleanSheets =
        ranking(
            playerStats,
            "cs"
        );


    const topMVPs =
        ranking(
            playerStats,
            "mvp"
        );


    // ==================================================
    // LEAGUE TABLE
    // ==================================================

    const leagueBody =
        $("#leagueBody");


    if (leagueBody) {

        leagueBody.innerHTML =
            table.map((x, index) => {

                const goalDifference =
                    x.gf - x.ga;


                return `

                    <tr>

                        <td class="rank">
                            ${index + 1}
                        </td>

                        <td>
                            <b>
                                ${esc(x.team.name)}
                            </b>
                        </td>

                        <td>
                            ${x.played}
                        </td>

                        <td>
                            ${x.wins}
                        </td>

                        <td>
                            ${x.draws}
                        </td>

                        <td>
                            ${x.losses}
                        </td>

                        <td>
                            ${x.gf}
                        </td>

                        <td>
                            ${x.ga}
                        </td>

                        <td>

                            ${
                                goalDifference > 0
                                    ? "+"
                                    : ""
                            }

                            ${goalDifference}

                        </td>

                        <td>

                            <b>
                                ${x.points}
                            </b>

                        </td>

                    </tr>

                `;

            }).join("");

    }


    // ==================================================
    // HOME CARDS
    // ==================================================

    const homeCards =
        $("#homeCards");


    if (homeCards) {

        homeCards.innerHTML = `

            <div class="card">

                <strong>
                    ${D.teams.length}
                </strong>

                <span>
                    TEAMS
                </span>

            </div>


            <div class="card">

                <strong>
                    ${D.matches.length}
                </strong>

                <span>
                    MATCHES
                </span>

            </div>


            <div class="card">

                <strong>
                    ${D.players.length}
                </strong>

                <span>
                    PLAYERS
                </span>

            </div>


            <div class="card">

                <strong>
                    ${
                        topGoals[0]
                            ?.goals || 0
                    }
                </strong>

                <span>
                    TOP GOALS
                </span>

            </div>

        `;

    }


    // ==================================================
    // HOME MATCHES
    // ==================================================

    const homeMatches =
        $("#homeMatches");


    if (homeMatches) {

        homeMatches.innerHTML =

            D.matches

                .slice(0, 4)

                .map(matchHTML)

                .join("")

            || empty();

    }


    // ==================================================
    // HOME SCORERS
    // ==================================================

    const homeScorers =
        $("#homeScorers");


    if (homeScorers) {

        homeScorers.innerHTML =

            topGoals

                .slice(0, 5)

                .map(
                    statHTML(
                        "goals",
                        "⚽"
                    )
                )

                .join("")

            || empty();

    }


    // ==================================================
    // MATCHES PAGE
    // ==================================================

    const matchesList =
        $("#matchesList");


    if (matchesList) {

        matchesList.innerHTML =

            D.matches

                .map(matchHTML)

                .join("")

            ||

            `

                <div class="panel">

                    No results yet.

                </div>

            `;

    }


    // ==================================================
    // GOALS
    // ==================================================

    const goals =
        $("#goals");


    if (goals) {

        goals.innerHTML =

            topGoals

                .map(
                    statHTML(
                        "goals",
                        "⚽"
                    )
                )

                .join("")

            || empty();

    }


    // ==================================================
    // ASSISTS
    // ==================================================

    const assists =
        $("#assists");


    if (assists) {

        assists.innerHTML =

            topAssists

                .map(
                    statHTML(
                        "assists",
                        "🎯"
                    )
                )

                .join("")

            || empty();

    }


    // ==================================================
    // CLEAN SHEETS
    // ==================================================

    const clean =
        $("#clean");


    if (clean) {

        clean.innerHTML =

            topCleanSheets

                .map(
                    statHTML(
                        "cs",
                        "🧤"
                    )
                )

                .join("")

            || empty();

    }


    // ==================================================
    // MVP
    // ==================================================

    const mvps =
        $("#mvps");


    if (mvps) {

        mvps.innerHTML =

            topMVPs

                .map(
                    statHTML(
                        "mvp",
                        "⭐"
                    )
                )

                .join("")

            || empty();

    }


    // ==================================================
    // CARDS
    // ==================================================

    const cards =
        $("#cards");


    if (cards) {

        const cardPlayers =
            playerStats

                .filter(
                    (p) =>
                        p.yellow + p.red > 0
                )

                .sort(
                    (a, b) =>
                        (b.yellow + b.red)
                        -
                        (a.yellow + a.red)
                );


        cards.innerHTML =

            cardPlayers

                .map((p) => `

                    <div class="statrow">

                        <span>

                            ${esc(p.name)}

                            <small>
                                ${esc(p.teamName)}
                            </small>

                        </span>

                        <b>

                            🟨 ${p.yellow}

                            &nbsp;

                            🟥 ${p.red}

                        </b>

                    </div>

                `)

                .join("")

            || empty();

    }


    // ==================================================
    // TEAMS
    // ==================================================

    renderTeamsPage();


    // ==================================================
    // ADMIN
    // ==================================================

    fillSelects();

    renderAdmin();

}


// ======================================================
// ADMIN SELECTS
// ======================================================

function fillSelects() {

    const teamOptions =

        D.teams

            .map((t) => `

                <option value="${t.id}">

                    ${esc(t.name)}

                </option>

            `)

            .join("");


    const home =
        $("#homeTeam");

    const away =
        $("#away");

    const playerTeam =
        $("#playerTeam");


    if (home) {
        home.innerHTML =
            teamOptions;
    }


    if (away) {
        away.innerHTML =
            teamOptions;
    }


    if (playerTeam) {
        playerTeam.innerHTML =
            teamOptions;
    }


    const playerOptions =

        D.players

            .map((p) => `

                <option value="${p.id}">

                    ${esc(p.name)}
                    —
                    ${esc(team(p.teamId).name)}

                </option>

            `)

            .join("");


    const cs =
        $("#cs");

    const mvp =
        $("#mvp");


    if (cs) {

        cs.innerHTML =

            `<option value="">
                None
            </option>`

            +

            playerOptions;

    }


    if (mvp) {

        mvp.innerHTML =

            `<option value="">
                None
            </option>`

            +

            playerOptions;

    }

}


// ======================================================
// CONVERT PLAYER NAMES TO IDS
// ======================================================

function namesToIds(text) {

    return text

        .split(",")

        .map(
            (x) =>
                x.trim()
        )

        .filter(Boolean)

        .map((name) => {

            const found =
                D.players.find(

                    (p) =>
                        p.name
                            .toLowerCase()
                        ===
                        name
                            .toLowerCase()

                );


            return found
                ? found.id
                : null;

        })

        .filter(Boolean);

}


// ======================================================
// ADD MATCH
// ======================================================

const matchForm =
    $("#matchForm");


if (matchForm) {

    matchForm.addEventListener(
        "submit",

        async (event) => {

            event.preventDefault();


            const newMatch = {

                date:
                    $("#date").value,

                homeTeamId:
                    $("#homeTeam").value,

                awayTeamId:
                    $("#away").value,

                homeGoals:
                    Number(
                        $("#hg").value
                    ),

                awayGoals:
                    Number(
                        $("#ag").value
                    ),

                scorers:
                    namesToIds(
                        $("#scorers").value
                    ),

                assists:
                    namesToIds(
                        $("#assistsInput").value
                    ),

                cleanSheetPlayerId:
                    $("#cs").value,

                mvpPlayerId:
                    $("#mvp").value,

                cards: []

            };


            // CARDS

            $("#cardsInput")
                .value
                .split("\n")
                .map(
                    (x) =>
                        x.trim()
                )
                .filter(Boolean)
                .forEach((line) => {

                    const parts =
                        line.split("-");


                    const playerName =
                        parts[0]?.trim();


                    const type =
                        parts[1]?.trim();


                    const foundPlayer =
                        D.players.find(

                            (p) =>
                                p.name
                                    .toLowerCase()
                                ===
                                playerName
                                    ?.toLowerCase()

                        );


                    if (foundPlayer) {

                        newMatch.cards.push({

                            playerId:
                                foundPlayer.id,

                            type:
                                type
                                    ?.toLowerCase()
                                    .includes("red")

                                    ? "red"

                                    : "yellow"

                        });

                    }

                });


            try {

                const response =
                    await fetch(
                        "/api/matches",
                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    newMatch
                                )

                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    $("#formMsg").textContent =
                        result.error ||
                        "Could not add match.";

                    return;

                }


                $("#formMsg").textContent =
                    "Match added ✓";


                matchForm.reset();


                await load();


                showPage(
                    "matches"
                );

            }

            catch (error) {

                console.error(
                    "Add match error:",
                    error
                );


                $("#formMsg").textContent =
                    "Could not add match.";

            }

        }

    );

}


// ======================================================
// ADD TEAM
// ======================================================

async function addTeam() {

    const input =
        $("#newTeam");


    const name =
        input.value.trim();


    if (!name) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/teams",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({
                            name
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Could not add team."
            );

            return;

        }


        input.value = "";


        await load();


        showPage("teams");

    }

    catch (error) {

        console.error(
            "Add team error:",
            error
        );

    }

}


// ======================================================
// ADD PLAYER
// ======================================================

async function addPlayer() {

    const input =
        $("#newPlayer");


    const name =
        input.value.trim();


    if (!name) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/players",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            name,

                            teamId:
                                $("#playerTeam").value,

                            position:
                                $("#position").value

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Could not add player."
            );

            return;

        }


        input.value = "";


        await load();


        showPage("teams");

    }

    catch (error) {

        console.error(
            "Add player error:",
            error
        );

    }

}


// ======================================================
// ADMIN MATCH LIST
// ======================================================

function renderAdmin() {

    const container =
        $("#adminMatches");


    if (!container) {
        return;
    }


    container.innerHTML =

        D.matches

            .map((match) => `

                <div class="statrow">

                    <span>

                        ${esc(
                            team(
                                match.homeTeamId
                            ).name
                        )}

                        ${match.homeGoals}

                        –

                        ${match.awayGoals}

                        ${esc(
                            team(
                                match.awayTeamId
                            ).name
                        )}

                    </span>


                    <button
                        class="delete"
                        onclick="delMatch('${match.id}')"
                    >

                        Delete

                    </button>

                </div>

            `)

            .join("")

        || empty();

}


// ======================================================
// DELETE MATCH
// ======================================================

async function delMatch(id) {

    const confirmed =
        confirm(
            "Delete this match?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await fetch(
            "/api/matches/" + id,
            {
                method: "DELETE"
            }
        );


        await load();

    }

    catch (error) {

        console.error(
            "Delete match error:",
            error
        );

    }

}



async function checkAdmin() {

    try {

        const response =
            await fetch("/api/admin-status");


        const data =
            await response.json();


        const login =
            document.querySelector("#adminLogin");


        const content =
            document.querySelector("#adminContent");


        if (!login || !content) {
            return;
        }


        if (data.loggedIn) {

            login.style.display = "none";
            content.style.display = "block";

            renderAdminManagement();

        }

        else {

            login.style.display = "block";
            content.style.display = "none";

        }

    }

    catch (error) {

        console.error(
            "Admin status error:",
            error
        );

    }

}

async function adminLogin() {

    const username =
        document.querySelector("#adminUsername").value;

    const password =
        document.querySelector("#adminPassword").value;


    const response =
        await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username,
                password
            })

        });


    const data =
        await response.json();


    if (!response.ok) {

        document.querySelector("#loginMessage")
            .textContent =
            data.error || "Login failed.";

        return;

    }


    document.querySelector("#loginMessage")
        .textContent = "";


    await checkAdmin();

}


async function adminLogout() {

    await fetch("/api/logout", {
        method: "POST"
    });

    await checkAdmin();

}


// ======================================================
// ADMIN MANAGEMENT
// ======================================================

function renderAdminManagement() {

    renderAdminTeams();

    renderAdminPlayers();

}


// ======================================================
// MANAGE TEAMS
// ======================================================

function renderAdminTeams() {

    const container =
        document.querySelector("#adminTeamsList");


    if (!container) {
        return;
    }


    container.innerHTML =
        D.teams.map((team) => `

            <div class="adminManageCard">

                <div class="adminManageHeader">

                    <strong>
                        ${esc(team.name)}
                    </strong>

                    <span>
                        ${esc(team.short || "")}
                    </span>

                </div>


                <label>

                    Team name

                    <input
                        id="team-name-${team.id}"
                        value="${esc(team.name)}"
                    >

                </label>


                <label>

                    Short name

                    <input
                        id="team-short-${team.id}"
                        value="${esc(team.short || "")}"
                    >

                </label>


                <label>

                    Logo path

                    <input
                        id="team-logo-${team.id}"
                        value="${esc(team.logo || "")}"
                        placeholder="assets/raja.png"
                    >

                </label>


                <div class="adminActions">

                    <button
                        class="primary smallButton"
                        onclick="updateTeam('${team.id}')"
                    >
                        💾 Save
                    </button>


                    <button
                        class="delete"
                        onclick="deleteTeam('${team.id}')"
                    >
                        🗑 Delete
                    </button>

                </div>

            </div>

        `).join("");

}


// ======================================================
// UPDATE TEAM
// ======================================================

async function updateTeam(id) {

    const name =
        document
            .querySelector(
                `#team-name-${id}`
            )
            .value
            .trim();


    const short =
        document
            .querySelector(
                `#team-short-${id}`
            )
            .value
            .trim();


    const logo =
        document
            .querySelector(
                `#team-logo-${id}`
            )
            .value
            .trim();


    const response =
        await fetch(
            `/api/teams/${id}`,
            {

                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        name,
                        short,
                        logo
                    })

            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        alert(
            result.error ||
            "Could not update team."
        );

        return;

    }


    await load();

    renderAdminManagement();

}


// ======================================================
// DELETE TEAM
// ======================================================

async function deleteTeam(id) {

    const selectedTeam =
        D.teams.find(
            team => team.id === id
        );


    if (!selectedTeam) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${selectedTeam.name}"?\n\n` +
            `Delete its players and matches first if necessary.`
        );


    if (!confirmed) {
        return;
    }


    const response =
        await fetch(
            `/api/teams/${id}`,
            {
                method: "DELETE"
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        alert(
            result.error ||
            "Could not delete team."
        );

        return;

    }


    await load();

    renderAdminManagement();

}


// ======================================================
// MANAGE PLAYERS
// ======================================================

function renderAdminPlayers() {

    const container =
        document.querySelector(
            "#adminPlayersList"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        D.players.map((player) => `

            <div class="adminManageCard">

                <strong>
                    ${esc(player.name)}
                </strong>


                <label>

                    Player name

                    <input
                        id="player-name-${player.id}"
                        value="${esc(player.name)}"
                    >

                </label>


                <label>

                    Team

                    <select
                        id="player-team-${player.id}"
                    >

                        ${D.teams.map((team) => `

                            <option
                                value="${team.id}"

                                ${
                                    team.id === player.teamId
                                        ? "selected"
                                        : ""
                                }
                            >

                                ${esc(team.name)}

                            </option>

                        `).join("")}

                    </select>

                </label>


                <label>

                    Position

                    <select
                        id="player-position-${player.id}"
                    >

                        <option
                            value=""
                            ${!player.position ? "selected" : ""}
                        >
                            No position
                        </option>

                        <option
                            value="GK"
                            ${player.position === "GK" ? "selected" : ""}
                        >
                            GK
                        </option>

                        <option
                            value="DF"
                            ${player.position === "DF" ? "selected" : ""}
                        >
                            DF
                        </option>

                        <option
                            value="MF"
                            ${player.position === "MF" ? "selected" : ""}
                        >
                            MF
                        </option>

                        <option
                            value="FW"
                            ${player.position === "FW" ? "selected" : ""}
                        >
                            FW
                        </option>

                    </select>

                </label>


                <div class="adminActions">

                    <button
                        class="primary smallButton"
                        onclick="updatePlayer('${player.id}')"
                    >
                        💾 Save
                    </button>


                    <button
                        class="delete"
                        onclick="deletePlayer('${player.id}')"
                    >
                        🗑 Delete
                    </button>

                </div>

            </div>

        `).join("");

}


// ======================================================
// UPDATE PLAYER
// ======================================================

async function updatePlayer(id) {

    const name =
        document
            .querySelector(
                `#player-name-${id}`
            )
            .value
            .trim();


    const teamId =
        document
            .querySelector(
                `#player-team-${id}`
            )
            .value;


    const position =
        document
            .querySelector(
                `#player-position-${id}`
            )
            .value;


    const response =
        await fetch(
            `/api/players/${id}`,
            {

                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        name,
                        teamId,
                        position
                    })

            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        alert(
            result.error ||
            "Could not update player."
        );

        return;

    }


    await load();

    renderAdminManagement();

}


// ======================================================
// DELETE PLAYER
// ======================================================

async function deletePlayer(id) {

    const selectedPlayer =
        D.players.find(
            player => player.id === id
        );


    if (!selectedPlayer) {
        return;
    }


    const confirmed =
        confirm(
            `Delete player "${selectedPlayer.name}"?`
        );


    if (!confirmed) {
        return;
    }


    const response =
        await fetch(
            `/api/players/${id}`,
            {
                method: "DELETE"
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        alert(
            result.error ||
            "Could not delete player."
        );

        return;

    }


    await load();

    renderAdminManagement();

}
// ======================================================
// START MARBALL
// ======================================================

load();
checkAdmin();


// ======================================================
// ABATERA AUTOMATIC COLOR THEMES
// Changes every 5 seconds
// ======================================================

const abateraThemes = [
    "theme-blue",
    "theme-green",
    "theme-red",
    "theme-yellow",
    "theme-purple"
];

let abateraThemeIndex = 0;

function changeAbateraTheme() {

    document.body.classList.remove(
        ...abateraThemes
    );

    document.body.classList.add(
        abateraThemes[abateraThemeIndex]
    );

    abateraThemeIndex++;

    if (abateraThemeIndex >= abateraThemes.length) {
        abateraThemeIndex = 0;
    }
}


// Start immediately with blue
changeAbateraTheme();


// Change every 5 seconds
setInterval(
    changeAbateraTheme,
    5000
);