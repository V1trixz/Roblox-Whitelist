local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local REMOTE_NAME = "WhitelistRemote"
local VALIDATION_URL = "https://SEU-SERVIDOR.COM/api/roblox/validate"
local SHARED_SECRET = "TROQUE_PELO_MESMO_SEGREDO_DO_ENV"

local remote = ReplicatedStorage:FindFirstChild(REMOTE_NAME)

if not remote then
	remote = Instance.new("RemoteEvent")
	remote.Name = REMOTE_NAME
	remote.Parent = ReplicatedStorage
end

local verifiedUsers = {}
local pendingValidation = {}
local movementState = {}

local function trim(text)
	return string.match(tostring(text or ""), "^%s*(.-)%s*$")
end

local function getCharacterParts(character)
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local rootPart = character and character:FindFirstChild("HumanoidRootPart")
	return humanoid, rootPart
end

local function removeForceField(character)
	if not character then
		return
	end

	local forceField = character:FindFirstChildOfClass("ForceField")

	if forceField then
		forceField:Destroy()
	end
end

local function lockCharacter(player, character)
	local humanoid, rootPart = getCharacterParts(character)

	if not humanoid then
		return
	end

	movementState[player.UserId] = {
		walkSpeed = humanoid.WalkSpeed,
		jumpPower = humanoid.JumpPower,
		jumpHeight = humanoid.JumpHeight,
		autoRotate = humanoid.AutoRotate,
		useJumpPower = humanoid.UseJumpPower,
		rootAnchored = rootPart and rootPart.Anchored or false
	}

	humanoid.WalkSpeed = 0
	humanoid.JumpPower = 0
	humanoid.JumpHeight = 0
	humanoid.AutoRotate = false

	if rootPart then
		rootPart.Anchored = true
	end

	if not character:FindFirstChildOfClass("ForceField") then
		local forceField = Instance.new("ForceField")
		forceField.Visible = true
		forceField.Parent = character
	end
end

local function unlockCharacter(player)
	local character = player.Character
	local savedState = movementState[player.UserId]
	local humanoid, rootPart = getCharacterParts(character)

	if humanoid and savedState then
		humanoid.WalkSpeed = savedState.walkSpeed or 16
		humanoid.AutoRotate = savedState.autoRotate ~= false

		if savedState.useJumpPower then
			humanoid.UseJumpPower = true
			humanoid.JumpPower = savedState.jumpPower or 50
		else
			humanoid.UseJumpPower = false
			humanoid.JumpHeight = savedState.jumpHeight or 7.2
		end
	end

	if rootPart and savedState then
		rootPart.Anchored = savedState.rootAnchored or false
	end

	removeForceField(character)
	movementState[player.UserId] = nil
end

local function validateCode(player, code)
	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = VALIDATION_URL,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-roblox-shared-secret"] = SHARED_SECRET
			},
			Body = HttpService:JSONEncode({
				code = code,
				robloxUserId = tostring(player.UserId),
				robloxUsername = player.Name
			})
		})
	end)

	if not success then
		return false, "Servidor indisponivel. Tente novamente."
	end

	local payload = nil

	if response.Body and response.Body ~= "" then
		local decoded, data = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)

		if decoded then
			payload = data
		end
	end

	if response.Success and response.StatusCode >= 200 and response.StatusCode < 300 then
		return true, payload
	end

	return false, payload and payload.message or "Codigo invalido."
end

local function handleCharacter(player, character)
	if verifiedUsers[player.UserId] then
		unlockCharacter(player)
		return
	end

	lockCharacter(player, character)
end

Players.PlayerAdded:Connect(function(player)
	player:SetAttribute("WhitelistVerified", false)

	player.CharacterAdded:Connect(function(character)
		handleCharacter(player, character)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	verifiedUsers[player.UserId] = nil
	pendingValidation[player.UserId] = nil
	movementState[player.UserId] = nil
end)

remote.OnServerEvent:Connect(function(player, action, payload)
	if verifiedUsers[player.UserId] then
		return
	end

	if action == "Decline" then
		player:Kick(string.format("Usuario %s nao tem codigo.", player.Name))
		return
	end

	if action ~= "SubmitCode" or type(payload) ~= "table" then
		return
	end

	if pendingValidation[player.UserId] then
		return
	end

	local code = string.upper(trim(payload.code))

	if code == "" then
		remote:FireClient(player, "ValidationFailed", {
			message = "Digite seu codigo."
		})
		return
	end

	pendingValidation[player.UserId] = true

	task.spawn(function()
		local ok, result = validateCode(player, code)
		pendingValidation[player.UserId] = nil

		if not player.Parent then
			return
		end

		if ok then
			verifiedUsers[player.UserId] = true
			player:SetAttribute("WhitelistVerified", true)
			unlockCharacter(player)
			remote:FireClient(player, "ValidationSuccess", {
				message = "Whitelist liberada."
			})
			return
		end

		remote:FireClient(player, "ValidationFailed", {
			message = tostring(result or "Codigo invalido.")
		})
	end)
end)
