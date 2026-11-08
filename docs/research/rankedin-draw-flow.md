# Rankedin organiser flow: registered players → draw → matches → schedule → publish

Source: Rankedin web bundle 5.15.8 (`rinweb/all.js`, minified Vue 2), `sw/swagger.json`, plus anonymous GETs against
`https://api.rankedin.com/v1` (2026-11-08). No POST was sent to Rankedin. Every quoted snippet is copied verbatim from `all.js`
(the char offset is given as `@N`).

Legend: **CONFIRMED** = read in UI code or seen in a live anonymous response. **UNCONFIRMED** = inferred, not tested.

---------------------------------------------------------------------------------------------------------------------

## 0. Transport conventions (applies to every call)

* Base URL: `nomenclatures.ApiDomain` = `https://api.rankedin.com/v1` (CONFIRMED from `GET /nomenclature/GetLayoutNomenclatures`).
  The UI writes paths in lower camel (`/tournament/GenerateMatchesAsync`). ASP.NET routing is case-insensitive (UNCONFIRMED but
  the bundle itself mixes `tournament/getroundrobinsettingsasync` and `tournament/GetCourtsAsync`).
* Auth: axios default instance with `withCredentials=!0` (`@4217448`:
  `n["default"].prototype.$http=i(),n["default"].prototype.$http.defaults.withCredentials=!0`). No Authorization header and no XSRF
  header are added to `$http` calls (the `X-XSRF-TOKEN` interceptor found belongs to a separate client class, not `$http`). So:
  session cookie + `Content-Type: application/json` + the `Origin/Referer: https://www.rankedin.com` you already send in
  `api/_lib/rinHeaders` is the whole contract.
* Request field casing: **the UI is inconsistent, and the server accepts both** (Newtonsoft, case-insensitive binding). Responses
  are **PascalCase** (`Id`, `IsPublished`, `WizardStep`), even though swagger shows camelCase. Below, every body is given in the
  exact casing the UI sends. Read responses PascalCase-first, camelCase fallback.
* Success: there is **no `ok` envelope** on any of these calls. The UI treats any 2xx as success and ignores the body except where
  noted (`CloseSignInAsync` → `data.message`; `PublishMatchesAsync` → boolean). Failures are non-2xx with a JSON body whose
  error code is read sometimes as `data.Code`, sometimes as `data.code` (both spellings appear, e.g.
  `t.response.data.Code==this.nomenclatures.ExceptionsEnum.Tournament_CanNotBeEdited` and
  `t.response.data.code==this.nomenclatures.ExceptionsEnum.NotFound_Tournament`), plus `data.type` (a translation key such as
  `"invalidArgument"`) and `data.message`. A 403 is detected by `this.$authClient.handleForbidden(e)`. → Implement:
  `code = body.Code ?? body.code; type = body.type ?? body.Type; message = body.message ?? body.Message`.
* Several operations are **asynchronous on the server** (generation and scheduling). The 2xx only means "accepted"; poll.
  Evidence: translation `tournament_DrawsStep_GenerateMatchesModalInfo` = "Are you sure you want to generate the matches? This
  operation might take a while. You will recieve notification with the outcome." and `tournament_SchedulingMatches` = "Matches
  are being scheduled at the moment. It will take couple of minutes. You will receive a notification once all matches are
  scheduled." (ExceptionsEnum `Tournament_SchedulingMatches` = 1328 is returned by `MatchesSettingsAsync` while that runs).

### Enums (live, from `GetLayoutNomenclatures`)

| Enum | Values |
|---|---|
| `EventStates` | Upcoming 1, Canceled 2, Active 3, Finished 4, SignupClosed 5, GeneratingMatches 6, MatchesGenerated 7 |
| `TournamentMenuStep` | Create 0, Logos 1, Classes 2, Players 3, CloseSignIn 4, Draws 5, Times 6, Matches 7, Start 8 (= the admin page index; UI menu shows +1, e.g. "6. Draws") |
| `TournamentDraws` (draw type) | Undefined 0, RoundRobin 1, Monrad 2, Elimination 3, Qualifying 8, Playoffs 9, RRPlayoffsQualification 10, QualificationDraw 11, MultiRoundRobin 12, Americano 13, PrivateMatch 14. UI also uses `DrawTypeIndex` 7 = "Groups + playoff" and 99 = "Draw creator / custom" (`this.isGroupsPlayoffChecked=7==this.model.DrawTypeIndex`, `this.isDrawCreatorChecked=99==this.model.DrawTypeIndex`). |
| `ExceptionsEnum` (relevant) | InvalidPermissions 2, InvalidState 3, InvalidData 4, EntityNotFound 501, NotFound_Tournament 502, Tournament_NoClasses 503, Tournament_NoDraws 504, Tournament_NoMatches 505, Forbidden 1000, Tournament_State_Active 1102, Tournament_NotEnoughPlayers 1103, Tournament_IsLocked 1104, Tournament_State_Finished 1110, Tournament_MatchesScheduledOnCourt 1112, Tournament_CanNotBeEdited 1122, Tournament_NotEditCourts 1123, Tournament_Cannot_Start 1125, ValidationError 1301, InvalidArgument 1302, Tournament_CourtsRequired 1324, Event_AlreadyFinished 1325, Tournament_AllowedDatesNotSet 1326, Tournament_TooLateToUncloseSignIn 1327, Tournament_SchedulingMatches 1328, Tournament_PlayerInDrawAndMatches 1329, InvalidOperation 1347 |

The admin pages map to `TournamentMenuStep`: closesignin (4) → drawssettings (5) → timesettings (6) → matchessettings (7, scheduling
and publish) → starttournament (8). The menu (`4635`, `@1192347`) disables nothing based on state — only `!isTournamentCreated` —
so ordering is enforced server-side, if at all.

---------------------------------------------------------------------------------------------------------------------

## 1. Which UI path gives a "pools only" draw? (answers Q1)

There are **three** ways the organiser UI creates a draw. Only two of them can produce a single-stage pools-only draw.

| Path | Calls | Result | Pools-only? |
|---|---|---|---|
| A. "Groups (Round Robin)" checkbox on drawssettings | `DrawsSettingsAsync {DrawTypeIndex:1}` → `GenerateMatchesAsync` | **One** round-robin draw with **all** class participants (draw named "RoundRobin") | Yes, but **1 pool only** |
| B. Draw creator | `SaveDrawCreatorAsync` with one draw `type:12` (MultiRoundRobin), `poolsCount:N` → `GenerateMatchesAsync` | One stage-0 draw split into N pools | **Yes, N pools** ← recommended for "2 pools" |
| C. Predefined wizard | `GetWizardTemplateAsync` → `CreateWizardDrawsAsync` → (draw creator page) → `GenerateMatchesAsync` | Always **two stages** (pools + a second draw) | **No** |

Evidence for A: the RR checkbox label is translation `drawsStep_GroupsRoundRobin` = "Groups (Round Robin)", info
`tournament_DrawsStep_RoundRobinInfo` = "In a round robin every player plays against every other player."; a live public class created
that way (tournament 74046, class 174928) has one stage-0 draw named `"RoundRobin"` and `GetDrawsForStageAndStrengthAsync` returns
**1** pool. There is no pool-count input on that path (`DrawsSettingsRequest` = tournamentId, drawTypeIndex, tournamentClassId, plates,
playoffs only).

Evidence for C (wizard always two stages): live `GET /Tournament/GetWizardTemplateAsync?optionId={1,2,3}&tournamentClassId=…`
(works anonymously):

```
OPTION 1 (drawsStep_GroupsGroups "Groups + groups")
  0 DrawAttributes          DrawType 12  asks DrawName(req), NumberOfPools(min 1), PoolNames(req), PoolSize(min 2); DynamicValidations {StepIndexToValidate:1}
  1 DrawSeededParticipants
  2 DrawMovement            AskToMoveWinnersOnly, AskToMoveAllPlayers
  3 DrawAttributes          DrawType 0   asks DrawName(req)  ("drawsStep_NameOfMainDraw")
  4 Summary
OPTION 2 (GroupsElimination): same, step 2 asks WinnersOnly / Nr1andNr2, step 3 DrawType 3 (Elimination)
OPTION 3 (GroupsMonrad):      same, step 3 DrawType 2 (Monrad)
```
Translation `drawsStep_GroupsGroupsInfo` = "Two Stages: 1st - In several round-robins players play against each other. 2nd - Winners
or all players will be moved to several round-robins…". So the wizard cannot yield pools-only; use Path B for 2 pools or Path A for 1.

---------------------------------------------------------------------------------------------------------------------

## 2. Wizard internals (Path C) — exact `steps` construction (Q1 detail)

Store (`@3907645`):
```
var _={state:{isLoading:!1,template:[],templateDynamicValidations:[],wizardData:[],summary:[],currentStepIndex:0,currentWizardOption:0,tournamentClassId:0},
 mutations:{… setWizardData(e,t){e.wizardData[t.stepIndex]=t}, … clearWizard(e){e.wizardData=[],e.summary=[],e.templateDynamicValidations=[]} …},
 getters:{… getIsSummaryStep:e=>()=>"Summary"==e.template[e.currentStepIndex].WizardStep, getIsLastStepExceptSummary:e=>()=>e.currentStepIndex==e.template.length-2, …
   getParticipantsDataSteps:e=>()=>o().filter(e.wizardData,function(e){return"undefined"!==typeof e&&"DrawSeededParticipants"===e.step}) …}}
```
So `wizardData[i]` is the whole object passed to `setWizardData`, **including a `stepIndex` field**, and `steps` is that array
(index = template step index; the Summary step writes nothing, so length = template.length-1).

Step component dispatch (`@471511`): `switch(this.currentWizardStep.WizardStep){case"DrawAttributes":…case"DrawSeededParticipants":…case"DrawMovement":…case"Summary":…}`.
**`step` is sent as the string name**, never as the integer:

* DrawAttributes (`@2193289`), defaults `data(){return{stepIndex:0,drawName:"",drawSize:0,numberOfPools:0,poolsNames:[],poolSize:0}}`:
  ```
  setWizardData(){…this.$store.dispatch("setWizardData",{step:"DrawAttributes",stepIndex:e.stepIndex,attributes:{drawName:e.drawName,drawSize:e.drawSize,numberOfPools:e.numberOfPools,poolSize:e.poolSize,poolsNames:e.poolsNames}}),
   …let t=e.drawSize;0==t&&this.poolSize>0&&(t=this.poolSize*this.numberOfPools),this.$store.dispatch("setDynamicValidations",{stepIndex:e.templateProps.DynamicValidations.StepIndexToValidate,validations:{Participants:{BetweenMin:0,BetweenMax:t}}})
  ```
  On mount, for draw types RoundRobin/MultiRoundRobin it pre-fills **100** pool names:
  `…DrawType!==this.nomenclatures.TournamentDraws.MultiRoundRobin&&…!==…RoundRobin||this.populatePoolNames(100)` with
  `t.poolsNames[s]="Group "+String.fromCharCode(e)` (A, B, C … continuing past "Z" into non-letters). The user edits only the first
  `numberOfPools` of them. Max participants for the next step = `poolSize*numberOfPools` when `drawSize==0`.
* DrawSeededParticipants (`@1545977`): `loadPlayers(){…let t=e.templateProps.Participants;if(e.players=t,…` and
  `savePlayers(){var e=this,t=this.players.filter(e=>e.IsSelected);this.$store.dispatch("setWizardData",{stepIndex:e.stepIndex,step:"DrawSeededParticipants",seededParticipants:t})}`.
  → `seededParticipants` are the **template's `Participants` objects verbatim (PascalCase)**, filtered to `IsSelected:true`:
  `{ParticipantId, Name, InitialOrder, RankingPosition, LowSeed, HighSeed, IsSelected:true}` (swagger `WizardParticipantModel`).
  Players already used in another participants step are disabled (`disabledParticipants` compares `ParticipantId`).
* DrawMovement (`@171801`), defaults `moveNr1WinnersOnly:!0,moveNr1andNr2Winners:!1,moveAllPlayers:!1`:
  `{step:"DrawMovement",stepIndex:e.stepIndex,movement:{moveNr1WinnersOnly:…,moveNr1andNr2Winners:…,moveAllPlayers:…}}` (exactly one true).
* Summary: no data; when reaching the step before it the mixin calls `GetWizardSummaryAsync` (`@448537`):
  `this.$http.post(\`${…}/tournament/GetWizardSummaryAsync/\`,{tournamentClassId:e,wizardOption:t.selectedWizardOption,steps:t.state.wizardData,language:t.layout.language})`.
  Response `{Draws:[{Name,DrawType,Size,Stage}],ValidationErrors:[string],IsValid:bool}`; "Create draws" is enabled only if `summary.IsValid`.
* Create (`@471511`):
  `this.$http.post(\`${…}/tournament/CreateWizardDrawsAsync\`,{tournamentClassId:t.tournamentClassId,wizardOption:t.selectedWizardOption,steps:t.state.wizardData}).then(e=>{t.hideModal(),…this.$router.push({name:"tournament-draws-creator",…})`
  — body ignored; any 2xx = success.

**WizardStep enum mapping**: UI only ever sends/compares names. Swagger lists `WizardStepTypesEnum` as `[1,2,3,4]` without names;
the order in which the templates present them suggests DrawAttributes=1, DrawSeededParticipants=2, DrawMovement=3, Summary=4 —
**UNCONFIRMED**. Send the string names like the UI does.

### Example wizard payload — option 1, 7 pairs, 2 pools (for reference only: it ALSO creates a stage-2 draw)

`POST /v1/tournament/CreateWizardDrawsAsync`
```json
{
  "tournamentClassId": 178304,
  "wizardOption": 1,
  "steps": [
    { "step": "DrawAttributes", "stepIndex": 0,
      "attributes": { "drawName": "Gruppspel", "drawSize": 0, "numberOfPools": 2, "poolSize": 4,
                      "poolsNames": ["Group A", "Group B", "Group C", "… 100 entries in the UI; only the first numberOfPools matter (UNCONFIRMED that 2 entries suffice)"] } },
    { "step": "DrawSeededParticipants", "stepIndex": 1,
      "seededParticipants": [
        { "ParticipantId": 111, "Name": "A / B", "InitialOrder": 1, "RankingPosition": 0, "LowSeed": 0, "HighSeed": 0, "IsSelected": true },
        "… 7 objects copied from template[1].Participants with IsSelected=true"
      ] },
    { "step": "DrawMovement", "stepIndex": 2,
      "movement": { "moveNr1WinnersOnly": true, "moveNr1andNr2Winners": false, "moveAllPlayers": false } },
    { "step": "DrawAttributes", "stepIndex": 3,
      "attributes": { "drawName": "Slutspel", "drawSize": 0, "numberOfPools": 0, "poolSize": 0, "poolsNames": [] } }
  ]
}
```
Constraint enforced client-side: selected participants ≤ `poolSize*numberOfPools` (=8 here). Preview first with
`GetWizardSummaryAsync` (same body + `"language":"en"`) and require `IsValid`.
After it, the draws exist in the draw-creator data; matches are still **not** generated (see §4).

---------------------------------------------------------------------------------------------------------------------

## 3. Recommended pools-only sequence (Path B, 2 pools) and Path A (1 pool)

Preconditions (both paths): logged-in organiser cookie for a tournament admin; class has ≥2 registered participants; tournament
has start/end dates and the class has play dates selected (else scheduling fails with `Tournament_AllowedDatesNotSet` 1326 —
`tournament_TimeStep_NoDateSelected` = "No dates for class selected. Please go to step 3 and select dates."); seeding valid
(`GetDrawsSettingsAsync.IsSeedingValid` — the Generate button is replaced by error `tournament_T10` "Seeding is not valid…"
otherwise).

### Step 1 — Close sign-in for the class (recommended, ordering UNCONFIRMED as mandatory)

`GET /v1/tournament/GetCloseSignInInfoAsync?tournamentId={tid}` → `{Classes:[{IsSignInOpen,TournamentClassName,TournamentClassId}], CanCloseSignIn, CanOpenSignIn, LevelsModel:{RankingLevels:[…]}, …}`.
The UI first calls a pre-check `GET /v1/tournament/GetCloseSignInMissingEntryFeesAsync?tournamentId={tid}&tournamentClassId={cid}`
(informational only; warns about unpaid fees) then:

`POST /v1/tournament/CloseTournamentClassSignInAsync`
```json
{ "tournamentClassId": 178304, "tournamentId": 75317 }
```
(or whole tournament: `POST /v1/tournament/CloseSignInAsync {"tournamentId":75317}` → UI shows `n.data.message`).
Evidence (`@2802178`):
`null==t.classId?this.$http.post(\`${…}/tournament/CloseSignInAsync\`,{tournamentId:t.tournamentId}):this.$http({method:"post",url:\`${…}/tournament/CloseTournamentClassSignInAsync\`,data:{tournamentClassId:t.classId,tournamentId:t.tournamentId}})`
Verify: re-GET `GetCloseSignInInfoAsync`, class `IsSignInOpen:false`. Undo: `POST /v1/tournament/OpenTournamentClassSignInAsync {"tournamentClassId","tournamentId"}`
(may fail with `Tournament_TooLateToUncloseSignIn` 1327).
Why recommended: `EventStates` progresses Upcoming(1) → SignupClosed(5) → GeneratingMatches(6) → MatchesGenerated(7) → Active(3);
the Generate button itself has no client check on sign-in state, so whether the server refuses generation with open sign-in is
**UNCONFIRMED**. Closing first is the UI's own step order (closesignin = step 5, drawssettings = step 6) and is harmless.

### Step 2 — Read draw settings for the class

`GET /v1/tournament/GetDrawsSettingsAsync?tournamentId={tid}&tournamentClassId={cid}`
Response (PascalCase): `{TournamentId, SelectedClassId, SelectedClassName, SelectedClassState, SelectedClassParticipantsCount,
SelectedClassIsPublished, EL:{Plates,Playoffs}, TournamentClasses:[{Id,Name,HasDrawTypeSelected,AreMatchesGenerated}],
DrawTypeIndex, MainDrawSize, MainDrawRealPlayers, TournamentState, IsSeedingValid, ShowPublishButton,
AreMatchesGeneratedForSelectedClass, HasSelectedClassBeenGeneratedAndScheduled, HasAnyClassGenerated, …}`.
Check: `IsSeedingValid==true`, `AreMatchesGeneratedForSelectedClass==false` (otherwise you are about to **regenerate**, which deletes
the existing draw — translation `tournament_T13`).

### Step 3a — Path A (1 pool): choose "Round Robin" draw type

`POST /v1/tournament/DrawsSettingsAsync` (PascalCase as sent by UI, `@499388`):
```json
{ "TournamentId": 75317, "DrawTypeIndex": 1, "TournamentClassId": 178304, "Plates": 0, "Playoffs": 0 }
```
```
updateSettings(t){…this.$http.post(`${…}/tournament/DrawsSettingsAsync`,{TournamentId:this.tournamentId,DrawTypeIndex:t,TournamentClassId:this.model.SelectedClassId,Plates:this.model.EL.Plates,Playoffs:this.model.EL.Playoffs}).then(t=>{this.model=t.data,…}).catch(t=>{…t.response.data.Code==this.nomenclatures.ExceptionsEnum.Tournament_CanNotBeEdited&&Pt.A.alert(this.translations["tournament_CreateEdit_CantEditTitle"])…})}
```
`Plates`/`Playoffs`: copy from `GET.EL` (only meaningful for Elimination). Response = full `GetDrawsSettingsResponse`; verify
`DrawTypeIndex==1`. If matches already exist the UI first confirms "In order to change the draw type, we will need to remove the
matches" — i.e. this call **deletes existing matches** for the class.

### Step 3b — Path B (N pools): save a MultiRoundRobin draw via the draw creator

1. `GET /v1/tournament/GetDrawCreatorAsync?tournamentId={tid}&tournamentClassId={cid}` → `{ClassName, ParticipantsCount, EventState, AreMatchesGenerated}`.
2. `GET /v1/tournament/GetDrawCreatorDataAsync?tournamentId={tid}&tournamentClassId={cid}` → `{ClassId, TournamentId, Draws:[…], AvailableParticipants:[{ParticipantId,Name,InitialOrder,RankingPosition,LowSeed,HighSeed,DrawStrength,DrawStage}], SeedList:[…], RankingType}`.
   If `Draws` is non-empty, a structure already exists (e.g. from the wizard) — clear it first (§6) or edit it.
3. `POST /v1/tournament/SaveDrawCreatorAsync` — body exactly as the UI builds it (`@1873174`):
   ```
   saveDraws(){var t=this.state.draws[0].filter(t=>t.hasDraw).concat(…draws[1]…).concat(…draws[2]…).concat(…draws[3]…),
     e={classId:this.state.classId,tournamentId:this.state.tournamentId,draws:t,needRegeneration:this.state.needRegeneration};
     … else this.$http.post(`${…}/tournament/SaveDrawCreatorAsync`,e).then(()=>{this.closeModal(),this.inSaving=!1,this.loadCreator()})}
   ```
   Each draw object is the store slot (`@3894627`) `{name,size,playoffs,plates,type,hasDraw,players,output,poolsCount,poolsNames,links,selectedLinks}`
   plus `stage`/`strength` (set by the draw-block on mount: `this.state.draws[this.strength][this.stage].stage=this.stage…`, values
   come from string props `stage:"0",strength:"0"`), `src`, `pools`, `drawId`. Select-draw modal (`@1844626`) writes
   `{…,name,size,playoffs,plates:selectedPlate,drawId,type:selectedDrawType.drawType,pools,output,poolsCount,poolsNames}` where
   `poolsNames = pools.map(t=>t.DrawName)` and new pools are `{DrawName:"",DrawId:0}`. Players come from the select-players modal
   (`selectPlayer(t){…t.IsSelected=!0,t.DrawStrength=this.draw.strength,t.DrawStage=this.draw.stage…}`), PascalCase.
   Validation in UI: name non-empty; type ≠ 0; `size>0`; for type 12 `poolsCount>0`; store `validate`: `size - players.length - selectedLinks.length >= 0`.

   Recommended body for 7 pairs, 2 pools (stage 0, strength 0 is the only stage-0 slot in the creator grid):
   ```json
   {
     "classId": 178304,
     "tournamentId": 75317,
     "needRegeneration": true,
     "draws": [
       {
         "stage": 0, "strength": 0,
         "type": 12, "name": "Gruppspel",
         "size": 7, "poolsCount": 2,
         "poolsNames": ["Grupp A", "Grupp B"],
         "pools": [ { "DrawName": "Grupp A", "DrawId": 0 }, { "DrawName": "Grupp B", "DrawId": 0 } ],
         "playoffs": null, "plates": null, "output": 0,
         "hasDraw": true,
         "players": [
           { "ParticipantId": 111, "Name": "A / B", "InitialOrder": 1, "RankingPosition": 0, "LowSeed": 0, "HighSeed": 0,
             "IsSelected": true, "DrawStrength": 0, "DrawStage": 0 },
           "… one per AvailableParticipants entry (all 7)"
         ],
         "links": [], "selectedLinks": []
       }
     ]
   }
   ```
   Notes: `size` for type 12 is labelled `drawsStep_DrawCreator_TotalPlayers` (total players across pools). The UI sends **no**
   `id` (it uses `drawId`, undefined for a new draw) — keep `id` absent/0 for a new draw. `needRegeneration` is set true by the UI
   whenever type/size/poolsCount/players change (`updateDraw` / `savePlayers` mutations); send `true` for a new structure.
   Whether an empty `players` array lets the server auto-fill all participants is **UNCONFIRMED** — send them explicitly.
   Assignment of pairs to the 2 pools is done by the server at generation time (seed-based) — you cannot pick the pool per pair
   in this payload (UNCONFIRMED; seeds via `UpdatePlayerSettingsAsync` are the lever).
   Response body ignored by UI (2xx = success).
4. Verify: re-GET `GetDrawCreatorDataAsync` → `Draws[0]` has `Type:12, PoolsCount:2, Players.length==7`; and
   `GetDrawsSettingsAsync` → `DrawTypeIndex==99` (custom; inferred from `isDrawCreatorChecked=99==this.model.DrawTypeIndex`, **UNCONFIRMED**
   that saving sets it) — the Generate button is disabled while `DrawTypeIndex==0`.
   Rename pools later without regeneration: `POST /v1/tournament/ChangeDrawNameAsync {"pools":[{"drawId":…,"drawName":"…","groupName":"<draw name>"}]}`
   (UI does this when only names changed, `onlyNameChanged`).

**Is the draw "final" after SaveDrawCreatorAsync / CreateWizardDrawsAsync? No.** The creator page has only Back / Clear everything
/ Save buttons; it never generates. Matches (and the placement of participants into the pools) are produced only by
`GenerateMatchesAsync` from the drawssettings page ("Generate draws for {class} - draw size {MainDrawSize}").

### Step 4 — Generate draw + matches (both paths)

`POST /v1/tournament/GenerateMatchesAsync` (PascalCase as sent, `@500090`):
```json
{ "TournamentId": 75317, "SelectedClassId": 178304 }
```
```
generateClass(){if(this.inClassesChange)return;const t=this.model.SelectedClassId;this.inClassesChange=!0,this.$http.post(`${…}/tournament/GenerateMatchesAsync`,{TournamentId:this.tournamentId,SelectedClassId:t}).then(()=>{this.load(this.tournamentId,t)})}
```
Preconditions (client): `model.IsSeedingValid && DrawTypeIndex!=0`. No `.catch` in the UI → no known error codes surfaced here.
It is asynchronous ("might take a while … you will receive notification"). If matches already exist this **regenerates**: the old
draw and its matches are deleted (`tournament_T13`: "In order to regenerate the draw, we will need to delete the old draw").
Verify by polling (every ~3–5 s, give up after ~2 min):
* `GET GetDrawsSettingsAsync?tournamentId&tournamentClassId` → `AreMatchesGeneratedForSelectedClass==true` (and `TournamentClasses[i].AreMatchesGenerated`), or
* `GET GetClassesForSchedulingAsync?tournamentId` → class `AreDrawsGenerated==true`, or
* `GET GetDrawCreatorAsync` → `AreMatchesGenerated==true`.
* Content: `GET /v1/tournament/GetDrawsForStageAndStrengthAsync?tournamentClassId={cid}&drawStrength=0&drawStage=0&isReadonly=false&language=en`
  → array, one element per pool, each `{BaseType:"RoundRobin", RoundRobin:{PoolId,Name,Pool:[[cells]],Standings,PoolNumber,…}}`
  (live sample: MRR class 177413 returned 3 elements = 3 pools; RR class 174928 returned 1).

### Step 5 — Courts (needed before scheduling)

`GET /v1/tournament/GetCourtsAsync?tournamentId={tid}` → `[{Id,TournamentId,CourtName,LocationName,CountryIndex,City,Address,Reference,Latitude,Longtitude}]`.
If empty, `POST /v1/tournament/AddCourtAsync` (camelCase as sent, `@1136364`):
```json
{ "address": "Storgatan 1", "city": "Stockholm", "countryIndex": 0, "courtName": "Bana 1", "id": 0,
  "latitude": 0, "locationName": "Padelhallen", "longitude": 0, "reference": "", "courtOrder": 0, "tournamentId": 75317 }
```
```
addCourtAjax(){…e={address:…,city:…,countryIndex:…,courtName:…,id:…,latitude:…,locationName:…,longitude:…,reference:…,courtOrder:t.courtModels.length,tournamentId:t.tournamentId};
 e.courtName&&e.address&&e.locationName&&e.city?(…this.$http({method:"post",url:`${…}/tournament/AddCourtAsync`,data:e}).then(…t.loadCourts()).catch(function(e){G.A.alert("Add court error",this.translations[e.response.data.type])…
```
Client-required: courtName, address, locationName, city. `countryIndex` is a `nomenclatures.Countries[].code` (UI default = first
country with code>0). Note the UI sends `longitude` while swagger names it `longtitude` (typo) — coordinates are probably lost either
way; harmless. One call per court; `courtOrder` = current count. Verify by re-GET. Remove: `DeleteCourtAsync {"id","tournamentId"}`
(fails with 1112 `Tournament_MatchesScheduledOnCourt` if matches are scheduled on it).

### Step 6 — Time settings (play-day window, match duration, courts per day)

`GET /v1/tournament/GetTimeSettingsAsync?tournamentid={tid}` → `{Id,Name,StartDate,EndDate,IsAnyMatchScheduled,IsLocked?,
SettingsCollection:[{Day,SettingsId,StartTime,EndTime,Duration,MaxCourts,MinBreak,HasScheduledMatches}],
SchedulingAdvancedSettings:[{ScheduleOrder,ClassId,Name,DateSettings:[{Day,SettingsId,EventId,EventName,MatchesPerDay,StartTime}],RoundsCount,MatchesCount,PlayersCount}]}`.
One `SettingsCollection` row per tournament play day (from the tournament dates). Empty → warning "No dates…" and nothing can be scheduled.

Modify in place and post the **whole model back** (`@1424905`):
```
updateSettings:function(){…this.$http.post(`${…}/tournament/UpdateSchedulingSettingsAsync`,{TournamentId:this.tournamentId,TimeSettingsCollection:t.model.SettingsCollection,AdvancedSettingsCollection:t.model.SchedulingAdvancedSettings}).then(e=>{null!==e.data&&t.saveSucceeded&&t.showSaveMessage(),…}).catch(e=>{t.saveSucceeded=!1,…"undefined"!==typeof e.response&&"invalidArgument"===e.response.data.type&&(t.errorMessage=e.response.data.message),…})}
```
Body:
```json
{
  "TournamentId": 75317,
  "TimeSettingsCollection": [
    { "Day": "<as returned>", "SettingsId": 9001, "StartTime": "09:00", "EndTime": "17:00",
      "Duration": 30, "MaxCourts": 2, "MinBreak": 30, "HasScheduledMatches": false, "IsChanged": true }
  ],
  "AdvancedSettingsCollection": "<SchedulingAdvancedSettings exactly as returned; optionally DateSettings[].MatchesPerDay / StartTime 'HH:mm'; ScheduleOrder 1..n>"
}
```
Field rules from the UI:
* `StartTime`/`EndTime`: the picker uses `format:"HH:mm"` and emits the formatted string (`updateStartTime(t,e){t.StartTime=e,this.markChange(t)}`);
  validator accepts 5-char "HH:mm" or the last 5 chars of a longer string → send `"HH:mm"`. `EndTime > StartTime` required.
* `Duration` = match length in minutes, required, ≥1 (UI binds it as a string; send int).
* `MinBreak` = `Duration * k`, k ∈ 0..5 (`setMinBreak:function(t,e){t.MinBreak=t.Duration*e,t.IsChanged=!0}`).
* `MaxCourts` = courts used that day (placeholder "1"). Relationship to the number of courts created in step 5 is **UNCONFIRMED** — keep `MaxCourts ≤ courts count`.
* Set `IsChanged:true` on rows you edit (the UI does).
* Advanced `MatchesPerDay` empty → null = "schedule maximum" (`tournament_TimeStep_RoundsPerDayInfoBtnText`). Advanced `StartTime` must be one of the day's slots (StartTime + n·Duration), else client error.
* If `IsAnyMatchScheduled` the UI warns: saving **deletes the current schedule** when a day with scheduled matches changed
  (`tournament_TimeStep_ToSaveSettingsInfo`), and you must reschedule.
Verify by re-GET. Errors: `data.type=="invalidArgument"` + `data.message`.

### Step 7 — Schedule the class

`GET /v1/tournament/GetClassesForSchedulingAsync?tournamentid={tid}` → `[{Name,Id,IsScheduled,AreDrawsGenerated}]`.

`POST /v1/tournament/ScheduleSingleClassAsync` (`@516074`):
```json
{ "tournamentClassId": 178304 }
```
```
scheduleClass(e){…this.$http.post(`${…}/tournament/ScheduleSingleClassAsync`,{tournamentClassId:e}).then(()=>{…this.getClassesForScheduling(),u.A.$emit("reloadTimetable")}).catch(e=>{…
  e.response.data.Code==…Tournament_CourtsRequired?y.A.alert("You should add at least 1 court before scheduling matches")
 :e.response.data.Code==…Tournament_NotEnoughPlayers?y.A.alert("You need at least 2 players to schedule matches")
 :e.response.data.Code==…Tournament_AllowedDatesNotSet?y.A.alert("Missing dates for selected class")
 :e.response.data.Code==…Event_AlreadyFinished&&y.A.alert("Tournament is already finished")})}
```
**Do not** use `ScheduleAllClassesAsync {"tournamentId"}` from PadelAdmin unless intended: UI warns
`tournament_MatchesStep_Schedule_RemoveModalBody` = "By confirming, you will replace the current schedule for all matches. This
action cannot be undone" — it reschedules every class in the tournament.
Preconditions: draws generated (§4), ≥1 court (1324), class play dates (1326), time settings saved, ≥2 players (1103).
Scheduling is async: poll `GetClassesForSchedulingAsync` until the class `IsScheduled==true`; while running,
`GET MatchesSettingsAsync` may fail with Code 1328 `Tournament_SchedulingMatches`. Then
`GET /v1/tournament/MatchesSettingsAsync?tournamentId={tid}` → `{Id,EventState,Name,AllDrawsArePublished,AreMatchesPublished,AllMatchesHaveCourt}`;
`AllMatchesHaveCourt==false` means some matches landed in the unscheduled ("red zone") area (window too small).
Manual moves exist (`MultiMoveMatchAsync`, court planner) — out of scope.

### Step 8 — Publish

Two independent public flags, both visible in the anonymous public endpoints:

* `GET /v1/tournament/GetClassesAndDrawNamesAsync?tournamentId={tid}` → `[{Id,Name,ShowDraws,TournamentDraws:[{Id,Name,Strength,Stage}],IsPublished}]`
  (live, tournament 75317 today: all classes `"ShowDraws":false,"TournamentDraws":[],"IsPublished":false`). The public draw page
  shows draws only when `IsPublished` (`isPublished:function(){return!this.isReadonly||…this.classNames[0].IsPublished}`).
* `GET /v1/tournament/GetMatchesSectionAsync?Id={tid}&LanguageCode=en&IsReadonly=true` → `{Matches:[…{Draw:"<pool name>",Court,Date,IsMatchScheduled,…}],AreMatchesPublished,IsSchedulePublished,AnyLineUpPublication}`.
  UI: `t.showMatches=e.data.AreMatchesPublished` and dates/courts only rendered when `IsSchedulePublished` (`generateDateAttribute(t,s)` with `s=t.IsSchedulePublished`).

8a. Publish draws — `POST /v1/tournament/PublishTournamentDrawsAsync` (`@498826`):
```json
{ "tournamentId": 75317, "publish": true }
```
```
publishDrawsToggle(t){…this.$http.post(`${…}/tournament/PublishTournamentDrawsAsync`,{tournamentId:this.tournamentId,publish:t}).then(()=>{t?d().alert(this.translations["tournament_DrawsStepJS_PublishDrawsSuccess"]):…,this.model.SelectedClassIsPublished=t…}).catch(()=>{d().alert(this.translations["tournament_DrawsStepJS_PublishDrawsFail"])…})}
```
**Tournament-wide**: the request carries no class id, although the toggle is displayed per selected class. Expect every class's
draws to become public (UNCONFIRMED exactly how per-class `IsPublished` is derived). Verify: `GetDrawsSettingsAsync.SelectedClassIsPublished`,
`MatchesSettingsAsync.AllDrawsArePublished`, public `GetClassesAndDrawNamesAsync[].IsPublished`.

8b. Publish match schedule — `POST /v1/tournament/PublishMatchesAsync` (`@518771`):
```json
{ "tournamentId": 75317 }
```
```
publishScheduleToggle(e){let t=" Draws are not published. If you publish the Match Times now, the draws will be automatically published as well";
  if(!this.model.AllDrawsArePublished&&e){…l().confirm(e,e=>{e&&this.publishMatches()})}else this.publishMatches()},
publishMatches(){this.isThinking=!0,this.$http.post(`${…}/tournament/PublishMatchesAsync`,{tournamentId:this.tournamentId}).then(()=>{this.isThinking=!1,l().alert("Success"),this.load()})}
```
**This is a TOGGLE** — the same body is sent for switching ON and OFF (no `publish` flag; swagger response is a `boolean`, presumably
the new state — UNCONFIRMED). Always `GET MatchesSettingsAsync` first and call only if `AreMatchesPublished==false`; re-GET to verify
it became `true`. Publishing matches also publishes draws (UI message above). Also tournament-wide.

8c. Calendar listing (unrelated to draws/matches visibility) — `POST /v1/tournament/SetIsPublishedInCalendarAsync`
`{"eventId":75317,"isPublished":true}` (`@1207342`); read with `GET /v1/tournament/GetIsPublishedInCalendarAsync?tournamentid={tid}` → `true|false`.

### Step 9 — Start tournament (NOT needed for publishing)

`GET /v1/tournament/GetStartTournamentModelAsync?tournamentId={tid}` → `{Id,EventState,AreStandingsGenerated}` (fails with
1125 `Tournament_Cannot_Start` → "Please select draws settings for all classes"). `POST /v1/tournament/StartTournamentAsync {"tournamentId"}`
sets `EventState=Active(3)` for the **whole tournament** (`this.currentState=this.nomenclatures.EventStates.Active`), errors 503
NoClasses / 1110 State_Finished. Because it is tournament-wide and requires draw settings for all classes, and because after Active
draw changes force a "your matches will be removed" path, keep it out of the automated flow. Referee codes require started tournament
(`tournament_NotStartedEnableRefereeCodes`). Whether results can be entered before start is UNCONFIRMED.

---------------------------------------------------------------------------------------------------------------------

## 4. Checklist endpoint (read-only progress)

`GET /v1/tournament/GetChecklistAsync?id={tid}` → `{TournamentId, ClassesCrossed, PlayersCrossed, CloseSignInCrossed,
GenerateDrawsCrossed, StartTournamentCrossed, FinishTournamentCrossed, IsInRole}` (UI reads PascalCase:
`!0===t.checklist.GenerateDrawsCrossed`). Tournament-level, so not precise enough for one class; `IsInRole` is a handy
"is this cookie an admin" probe.

---------------------------------------------------------------------------------------------------------------------

## 5. Ordered minimal sequence (Path B, one class, 2 pools)

| # | Call | Body | Verify |
|---|---|---|---|
| 0 | GET `GetChecklistAsync?id=tid` | – | `IsInRole` true (else 403 everywhere) |
| 1 | POST `CloseTournamentClassSignInAsync` | `{tournamentClassId,tournamentId}` | `GetCloseSignInInfoAsync` class `IsSignInOpen:false` |
| 2 | GET `GetDrawsSettingsAsync?tournamentId&tournamentClassId` | – | `IsSeedingValid`, `!AreMatchesGeneratedForSelectedClass` |
| 3 | GET `GetDrawCreatorDataAsync?tournamentId&tournamentClassId` | – | `Draws` empty; take `AvailableParticipants` |
| 4 | POST `SaveDrawCreatorAsync` | §3b body | re-GET creator data: 1 draw, Type 12, PoolsCount 2, 7 players; `GetDrawsSettingsAsync.DrawTypeIndex != 0` |
| 5 | POST `GenerateMatchesAsync` | `{TournamentId,SelectedClassId}` | poll `GetDrawsSettingsAsync.AreMatchesGeneratedForSelectedClass` |
| 6 | GET/POST `GetCourtsAsync` / `AddCourtAsync` | §Step 5 | ≥1 court |
| 7 | GET `GetTimeSettingsAsync` → POST `UpdateSchedulingSettingsAsync` | full model with edits | re-GET |
| 8 | POST `ScheduleSingleClassAsync` | `{tournamentClassId}` | poll `GetClassesForSchedulingAsync` `IsScheduled`; `MatchesSettingsAsync.AllMatchesHaveCourt` |
| 9 | POST `PublishTournamentDrawsAsync` | `{tournamentId,publish:true}` | `MatchesSettingsAsync.AllDrawsArePublished` |
| 10 | GET `MatchesSettingsAsync`; if `!AreMatchesPublished` POST `PublishMatchesAsync` | `{tournamentId}` | `AreMatchesPublished==true`; public `GetMatchesSectionAsync` shows matches |

Path A replaces 3–4 by `POST DrawsSettingsAsync {TournamentId,DrawTypeIndex:1,TournamentClassId,Plates,Playoffs}` (single pool).

---------------------------------------------------------------------------------------------------------------------

## 6. Undo paths (before publishing)

| Mistake | Undo | Evidence / caveats |
|---|---|---|
| Wrong schedule | `POST DeleteScheduleForClassAsync {"tournamentClassId"}` | `deleteScheduleForClass(e){…post(…/DeleteScheduleForClassAsync,{tournamentClassId:e})…}` (`@515708`). Required before changing class play dates. |
| Wrong draw structure / pools / matches | `POST ClearDrawCreatorAsync {"tournamentId","tournamentClassId"}` — removes all draws of the class **and their matches** ("Clear everything") | `clearEverything(){this.disableClear||(this.shouldShowModal&&!this.showClearModal?…:(…this.$http.post(…/ClearDrawCreatorAsync,{tournamentId:this.tournamentId,tournamentClassId:this.tournamentClassId})…))}`; disabled when `EventState==Finished`; modal text "Your current draw will be removed … Do you confirm removing the matches?". Whether it also resets `DrawTypeIndex` is UNCONFIRMED — re-GET `GetDrawsSettingsAsync`. Clear the schedule first (UNCONFIRMED whether required). |
| Wrong pool assignment only | `POST GenerateMatchesAsync` again (= regenerate; deletes old draw + matches) | `tournament_T13` text. Must reschedule afterwards. |
| Wrong draw type (Path A) | `POST DrawsSettingsAsync` with another `DrawTypeIndex` (removes matches if generated) | `tournament_T17`. |
| Draws published by mistake | `POST PublishTournamentDrawsAsync {"tournamentId","publish":false}` | tournament-wide |
| Schedule published by mistake | `POST PublishMatchesAsync {"tournamentId"}` again (toggle) — only if `AreMatchesPublished==true` | |
| Sign-in closed by mistake | `POST OpenTournamentClassSignInAsync {"tournamentClassId","tournamentId"}` | may fail 1327 `Tournament_TooLateToUncloseSignIn` (likely once matches exist — UNCONFIRMED) |
| Pool names | `POST ChangeDrawNameAsync {"pools":[{"drawId","drawName","groupName"}]}` | no regeneration |

---------------------------------------------------------------------------------------------------------------------

## 7. UNCONFIRMED list (test on a throw-away tournament first)

1. Whether `GenerateMatchesAsync` requires sign-in closed (state 5) or works from Upcoming(1).
2. Whether `SaveDrawCreatorAsync` sets `DrawTypeIndex` to 99 (Generate button is disabled at 0), and whether an empty `players` list is auto-filled.
3. Exact casing tolerance: UI mixes PascalCase (`DrawsSettingsAsync`, `GenerateMatchesAsync`, `UpdateSchedulingSettingsAsync`) and camelCase (`CreateWizardDrawsAsync`, `AddCourtAsync`, `ScheduleSingleClassAsync`); mirroring the UI per call is the safe choice.
4. `PublishMatchesAsync` toggle semantics and its boolean response meaning.
5. Tournament-wide effect of `PublishTournamentDrawsAsync` (affects other classes of the same tournament).
6. `GetTimeSettingsAsync` `StartTime` wire format (UI normalises to `"HH:mm"`); `MaxCourts` vs. number of courts.
7. `WizardStepTypesEnum` integer mapping (UI sends string names).
8. Poll timings for async generation/scheduling (no SignalR used by us).
