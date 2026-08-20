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

      const prompt = `
        다음 정보를 바탕으로 대화 가능한 주요 등장인물 3~5명의 이름만 쉼표(,)로 구분하여 응답해줘.
        작품명: ${mediaTitle}
        대본/내용: ${scriptText.slice(0, 1000)}
        응답 형식 예시: Sherlock Holmes, Dr. John Watson, Jim Moriarty
      `;

      const result = await model.generateContent(prompt);
      const charList = result.response.text().split(",").map((c) => c.trim());
      setCharacters(charList);
      setStep("character_select");
    } catch (error) {
      alert("분석에 실패했습니다. API 키를 확인해주세요.");
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

      const systemInstruction = `
        You are '${selectedCharacter}' from '${mediaTitle}'. 
        Language to converse in: ${language}.
        Always maintain your persona strictly.
        Mode: ${mode === "beginner" ? "Use simple words and clear sentences." : "Speak naturally as a native speaker."}
      `;

      const chatPrompt = `${systemInstruction}\n\nChat History:\n${newMessages
        .map((m) => `${m.sender}: ${m.text}`)
        .join("\n")}\nai:`;

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

      const prompt = `
        다음 대화 내역을 바탕으로 사용자의 ${language} 언어 학습 피드백을 JSON 형식으로만 응답해줘.
        {
          "grammar": ["문법적 오류 교정"],
          "betterExpressions": ["더 자연스러운 표현"],
          "tips": "총평 팁"
        }

        대화 내역:
        ${messages.map((m) => `${m.sender}: ${m.text}`).join("\n")}
      `;

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
          </div>

          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
              <Globe className="w-4 h-4" /> 학습 언어 선택
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["English", "Japanese", "Spanish"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`p-2.5 rounded-lg text-sm font-medium border transition ${
                    language === lang
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  {lang === "English" ? "영어 🇺🇸" : lang === "Japanese" ? "일본어 🇯🇵" : "스페인어 🇪🇸"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
            <label className="text-sm font-semibold text-indigo-300">대화 난이도 선택</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("beginner")}
                className={`p-3 rounded-xl text-left border flex flex-col gap-1 transition ${
                  mode === "beginner" ? "bg-indigo-950 border-indigo-500 text-indigo-200" : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                <span className="font-bold text-sm">🌱 초보 모드</span>
                <span className="text-xs opacity-75">마이크 버튼을 누르고 대화</span>
              </button>
              <button
                onClick={() => setMode("advanced")}
                className={`p-3 rounded-xl text-left border flex flex-col gap-1 transition ${
                  mode === "advanced" ? "bg-amber-950 border-amber-500 text-amber-200" : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                <span className="font-bold text-sm">🔥 고수 모드</span>
                <span className="text-xs opacity-75">실속 빠른 원어민 대화</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
              <BookOpen className="w-4 h-4" /> 작품 제목 또는 대본
            </label>
            <input
              type="text"
              placeholder="예: 해리포터, 셜록, 어벤져스..."
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={analyzeMediaOrScript}
              disabled={isAnalyzing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg text-sm transition flex justify-center items-center gap-2"
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "등장인물 분석하기"}
            </button>
          </div>
        </div>
      )}

      {step === "character_select" && (
        <div className="flex-1 flex flex-col justify-center my-6 gap-4">
          <h2 className="text-lg font-bold text-center text-indigo-300">대화하고 싶은 캐릭터를 선택하세요</h2>
          <div className="space-y-3">
            {characters.map((char) => (
              <button
                key={char}
                onClick={() => startConversation(char)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl text-left font-semibold flex justify-between items-center transition"
              >
                <span>{char}</span>
                <UserCheck className="w-5 h-5 text-indigo-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "chat" && (
        <div className="flex-1 flex flex-col justify-between my-4">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex justify-between items-center mb-4">
            <div>
              <p className="text-xs text-slate-400">대화 상대</p>
              <p className="font-bold text-indigo-300">{selectedCharacter}</p>
            </div>
            <button
              onClick={handleEndConversation}
              className="bg-red-600/80 hover:bg-red-600 text-white text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5" /> 대화 종료
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                    m.sender === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
            <div className="flex justify-center items-center gap-2 h-6">
              {isAiSpeaking && <span className="text-xs text-indigo-400 animate-pulse">🔊 AI가 말하는 중...</span>}
              {isRecording && <span className="text-xs text-red-400 animate-pulse">🎙️ 듣고 있는 중... 말해보세요!</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleRecording}
                className={`p-3.5 rounded-full text-white transition ${
                  isRecording ? "bg-red-600 animate-bounce" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input
                type="text"
                placeholder="텍스트 입력..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button onClick={() => handleSendMessage()} className="bg-slate-800 border border-slate-700 p-3 rounded-xl hover:bg-slate-700">
                <Send className="w-5 h-5 text-indigo-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "feedback" && (
        <div className="flex-1 flex flex-col justify-center gap-4 my-6">
          <div className="text-center space-y-1">
            <Award className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="text-lg font-bold">학습 피드백 리포트</h2>
          </div>

          {!feedback ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-400" />
              피드백 분석 중입니다...
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-amber-300 mb-2">🟢 문법 교정</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {feedback.grammar?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-indigo-300 mb-2">🔵 더 자연스러운 현지 표현</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {feedback.betterExpressions?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-emerald-300 mb-1">💡 총평 팁</h3>
                <p className="text-slate-300">{feedback.tips}</p>
              </div>

              <button
                onClick={() => setStep("setup")}
                className="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold py-3 rounded-xl transition mt-2"
              >
                새 대화 시작하기
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
