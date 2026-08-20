"use client";

import React, { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mic, MicOff, Send, Key, Globe, Square, Award, Sparkles, BookOpen, UserCheck, RefreshCw } from "lucide-react";

type Language = "English" | "Japanese" | "Spanish";
type Mode = "beginner" | "advanced";

interface Message {
  sender: "user" | "ai";
  text: string;
}

interface Feedback {
  grammar: string[];
  betterExpressions: string[];
  tips: string;
}

export default function Home() {
  const [apiKey, setApiKey] = useState<string>("");
  const [language, setLanguage] = useState<Language>("English");
  const [mode, setMode] = useState<Mode>("beginner");

  const [mediaTitle, setMediaTitle] = useState<string>("");
  const [scriptText, setScriptText] = useState<string>("");
  const [characters, setCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [step, setStep] = useState<"setup" | "character_select" | "chat" | "feedback">("setup");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  };

  const analyzeMediaOrScript = async () => {
    if (!apiKey) return alert("Gemini API Key를 입력해주세요!");
    if (!mediaTitle && !scriptText) return alert("작품 제목을 입력하거나 대본 파일 내용을 붙여넣어 주세요!");

    setIsAnalyzing(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = "작품명: " + mediaTitle + "\n대본/내용: " + scriptText.slice(0, 1000) + "\n위 정보를 바탕으로 대화 가능한 주요 등장인물 3~5명의 이름만 쉼표(,)로 구분하여 응답해줘. 예시: Sherlock Holmes, Dr. John Watson, Jim Moriarty";

      const result = await model.generateContent(prompt);
      const charList = result.response.text().split(",").map((c) => c.trim());
      setCharacters(charList);
      setStep("character_select");
    } catch (error) {
      alert("분석에 실패했습니다. API 키나 크롬 콘솔 에러를 확인해주세요.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startConversation = (character: string) => {
    setSelectedCharacter(character);
    setMessages([
      {
        sender: "ai",
        text: `Hello! I am ${character}. Let's practice ${language} together. What would you like to talk about today?`,
      },
    ]);
    setStep("chat");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const newMessages: Message[] = [...messages, { sender: "user", text }];
    setMessages(newMessages);
    setInputText("");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemInstruction = "You are '" + selectedCharacter + "' from '" + mediaTitle + "'. Language to converse in: " + language + ". Always maintain your persona strictly. Mode: " + (mode === "beginner" ? "Use simple words and clear sentences." : "Speak naturally as a native speaker.");

      const chatPrompt = systemInstruction + "\n\nChat History:\n" + newMessages.map((m) => m.sender + ": " + m.text).join("\n") + "\nai:";

      const result = await model.generateContent(chatPrompt);
      const aiReply = result.response.text();

      setMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
      speakText(aiReply, language);
    } catch (error) {
      console.error(error);
    }
  };

  const speakText = (text: string, lang: Language) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (lang === "English") utterance.lang = "en-US";
    if (lang === "Japanese") utterance.lang = "ja-JP";
    if (lang === "Spanish") utterance.lang = "es-ES";

    setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 사용해주세요.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "English" ? "en-US" : language === "Japanese" ? "ja-JP" : "es-ES";

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const handleEndConversation = async () => {
    window.speechSynthesis.cancel();
    setStep("feedback");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const historyText = messages.map((m) => m.sender + ": " + m.text).join("\n");
      const prompt = "다음 대화 내역을 바탕으로 사용자의 " + language + " 언어 학습 피드백을 JSON 형식으로만 응답해줘.\n{\n  \"grammar\": [\"문법적 오류 교정\"],\n  \"betterExpressions\": [\"더 자연스러운 표현\"],\n  \"tips\": \"총평 팁\"\n}\n\n대화 내역:\n" + historyText;

      const result = await model.generateContent(prompt);
      const textResult = result.response.text().replace(/```json|```/g, "").trim();
      setFeedback(JSON.parse(textResult));
    } catch (e) {
      console.error("피드백 생성 오류", e);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 max-w-md mx-auto flex flex-col justify-between font-sans">
      <header className="py-4 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Persona Talk
        </h1>
        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
          {language} • {mode === "beginner" ? "🌱 초보" : "🔥 고수"}
        </span>
      </header>

      {step === "setup" && (
        <div className="flex-1 flex flex-col justify-center gap-6 my-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
              <Key className="w-4 h-4" /> Gemini API Key
            </label>
            <input
              type="password"
              placeholder="API 키를 입력하세요"
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
            />
