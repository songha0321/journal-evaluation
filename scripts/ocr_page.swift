// 인쇄본 PDF(텍스트가 윤곽선으로 변환되어 pdftotext가 먹지 않는 것) OCR용.
// macOS Vision 프레임워크를 그대로 쓴다. tesseract 설치가 필요 없고 한국어 정확도가 높다.
//
//   swiftc -O scripts/ocr_page.swift -o out/ocr_page
//   pdftoppm -r 300 -f 10 -l 10 -png input.pdf out/page   # → out/page-10.png
//   out/ocr_page out/page-10.png
//
// 출력: 인식된 텍스트 줄마다 한 줄 (JSON을 쓰려면 --json).
// --json이면 {text, confidence, x, y, w, h} 배열을 낸다 — 본문/사이드바 comment를
// x좌표로 가르려면 좌표가 필요하다.

import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: ocr_page <image.png> [--json]\n".data(using: .utf8)!)
    exit(2)
}
let path = args[1]
let asJSON = args.contains("--json")

guard let image = NSImage(contentsOfFile: path),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("이미지를 열 수 없음: \(path)\n".data(using: .utf8)!)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["ko-KR", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    FileHandle.standardError.write("OCR 실패: \(error)\n".data(using: .utf8)!)
    exit(1)
}

let observations = request.results ?? []
if asJSON {
    var out: [[String: Any]] = []
    for o in observations {
        guard let top = o.topCandidates(1).first else { continue }
        let b = o.boundingBox   // 좌하단 원점, 0~1 정규화
        out.append([
            "text": top.string,
            "confidence": top.confidence,
            "x": b.origin.x, "y": b.origin.y,
            "w": b.size.width, "h": b.size.height,
        ])
    }
    let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .withoutEscapingSlashes])
    FileHandle.standardOutput.write(data)
} else {
    for o in observations {
        if let top = o.topCandidates(1).first {
            print(top.string)
        }
    }
}
