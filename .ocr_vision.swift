import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("usage: ocr <image-path>\n", stderr)
    exit(1)
}
let path = args[1]

guard let image = NSImage(contentsOfFile: path),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("cannot load image: \(path)\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])

guard let observations = request.results else {
    fputs("no results\n", stderr)
    exit(1)
}

struct Line {
    let text: String
    let top: CGFloat
    let left: CGFloat
    let height: CGFloat
}

var lines: [Line] = []
for obs in observations {
    guard let candidate = obs.topCandidates(1).first else { continue }
    let box = obs.boundingBox // normalized, origin bottom-left
    lines.append(Line(text: candidate.string,
                      top: 1.0 - box.origin.y,
                      left: box.origin.x,
                      height: box.height))
}

// group into rows by top coordinate (within half of median height)
let medianH = lines.map { $0.height }.sorted()[lines.count / 2]
var sorted = lines.sorted { $0.top < $1.top }
var rows: [[Line]] = []
for line in sorted {
    if let lastRow = rows.last, let lastInRow = lastRow.last,
       abs(line.top - lastInRow.top) < medianH * 0.6 {
        rows[rows.count - 1].append(line)
    } else {
        rows.append([line])
    }
}

for row in rows {
    let cols = row.sorted { $0.left < $1.left }
    let text = cols.map { $0.text }.joined(separator: "\t")
    let y = Int(((1.0 - cols[0].top) * 1000).rounded())
    print("ROW\(String(format: "%04d", y))\t\(text)")
}
