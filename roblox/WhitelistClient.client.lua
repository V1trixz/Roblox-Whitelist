local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local remote = ReplicatedStorage:WaitForChild("WhitelistRemote")

local whitelistGui = playerGui:WaitForChild("Whitelist")
local prompt = whitelistGui:WaitForChild("Prompt")
local window = prompt:WaitForChild("Window")

local yesButton = window:WaitForChild("Yes")
local noButton = window:WaitForChild("No")
local codeBox = window:WaitForChild("Code")

local BLOCK_ACTIONS = {
	Enum.PlayerActions.CharacterForward,
	Enum.PlayerActions.CharacterBackward,
	Enum.PlayerActions.CharacterLeft,
	Enum.PlayerActions.CharacterRight,
	Enum.PlayerActions.CharacterJump
}

local CORE_GUI_TYPES = {
	Enum.CoreGuiType.Backpack,
	Enum.CoreGuiType.Chat,
	Enum.CoreGuiType.EmotesMenu,
	Enum.CoreGuiType.Health,
	Enum.CoreGuiType.PlayerList
}

local hiddenGuis = {}
local coreGuiState = {}

local loadingToken = 0
local isLocked = true
local isSubmitting = false
local showingSystemText = false

local defaultTextColor = codeBox.TextColor3
local defaultPlaceholder = codeBox.PlaceholderText
local green = Color3.fromRGB(65, 220, 120)
local red = Color3.fromRGB(255, 90, 90)

local function trim(text)
	return string.match(tostring(text or ""), "^%s*(.-)%s*$")
end

local function sinkMovement()
	return Enum.ContextActionResult.Sink
end

local function bindMovementLock()
	for _, action in ipairs(BLOCK_ACTIONS) do
		ContextActionService:BindAction("Whitelist_" .. action.Name, sinkMovement, false, action)
	end
end

local function unbindMovementLock()
	for _, action in ipairs(BLOCK_ACTIONS) do
		ContextActionService:UnbindAction("Whitelist_" .. action.Name)
	end
end

local function setCoreGuiVisible(visible)
	for _, coreGuiType in ipairs(CORE_GUI_TYPES) do
		if not visible then
			local ok, currentState = pcall(function()
				return StarterGui:GetCoreGuiEnabled(coreGuiType)
			end)

			if ok then
				coreGuiState[coreGuiType] = currentState
			end
		end

		pcall(function()
			local enabled = visible and coreGuiState[coreGuiType] ~= false or false
			StarterGui:SetCoreGuiEnabled(coreGuiType, enabled)
		end)
	end
end

local function hideGui(guiObject)
	if guiObject == whitelistGui or not guiObject:IsA("LayerCollector") then
		return
	end

	if guiObject.Enabled then
		hiddenGuis[guiObject] = true
	end

	guiObject.Enabled = false
end

local function hideOtherGuis()
	for _, guiObject in ipairs(playerGui:GetChildren()) do
		hideGui(guiObject)
	end
end

local function restoreOtherGuis()
	for guiObject in pairs(hiddenGuis) do
		if guiObject and guiObject.Parent then
			guiObject.Enabled = true
		end
	end

	table.clear(hiddenGuis)
end

local function setButtonsEnabled(enabled)
	yesButton.Active = enabled
	yesButton.AutoButtonColor = enabled
	noButton.Active = enabled
	noButton.AutoButtonColor = enabled
end

local function setCodeMessage(message, color)
	showingSystemText = true
	codeBox.Text = message
	codeBox.TextColor3 = color
	codeBox.PlaceholderText = defaultPlaceholder
end

local function stopLoading()
	loadingToken += 1
end

local function startLoading()
	loadingToken += 1
	local currentToken = loadingToken
	local dots = 1

	showingSystemText = true

	task.spawn(function()
		while currentToken == loadingToken do
			codeBox.Text = "Carregando" .. string.rep(".", dots)
			codeBox.TextColor3 = green
			dots += 1

			if dots > 3 then
				dots = 1
			end

			task.wait(0.35)
		end
	end)
end

local function unlockWhitelist()
	if not isLocked then
		return
	end

	isLocked = false
	isSubmitting = false

	stopLoading()
	setButtonsEnabled(true)
	unbindMovementLock()
	restoreOtherGuis()
	setCoreGuiVisible(true)

	whitelistGui.Enabled = false
end

codeBox.Focused:Connect(function()
	if showingSystemText then
		codeBox.Text = ""
		codeBox.TextColor3 = defaultTextColor
		showingSystemText = false
	end
end)

yesButton.MouseButton1Click:Connect(function()
	if not isLocked or isSubmitting then
		return
	end

	local enteredCode = trim(codeBox.Text)

	if enteredCode == "" or showingSystemText then
		setCodeMessage("Digite seu codigo.", red)
		return
	end

	isSubmitting = true
	setButtonsEnabled(false)
	startLoading()

	remote:FireServer("SubmitCode", {
		code = enteredCode
	})
end)

noButton.MouseButton1Click:Connect(function()
	if not isLocked then
		return
	end

	setButtonsEnabled(false)
	remote:FireServer("Decline")
end)

playerGui.ChildAdded:Connect(function(child)
	if isLocked then
		task.defer(hideGui, child)
	end
end)

remote.OnClientEvent:Connect(function(action, payload)
	if action == "ValidationSuccess" then
		unlockWhitelist()
		return
	end

	if action == "ValidationFailed" then
		stopLoading()
		isSubmitting = false
		setButtonsEnabled(true)
		setCodeMessage(payload and payload.message or "Codigo errado.", red)
	end
end)

whitelistGui.Enabled = true
bindMovementLock()
hideOtherGuis()
setCoreGuiVisible(false)
