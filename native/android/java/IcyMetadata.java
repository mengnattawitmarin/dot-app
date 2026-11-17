package com.mengnattawit.dot;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import javax.net.ssl.SSLSocketFactory;

/**
 * Reads the current song title ("StreamTitle") from an Icecast / SHOUTcast stream.
 * Uses a raw socket because SHOUTcast v1 answers "ICY 200 OK", which HttpURLConnection rejects.
 * Each call downloads only up to the first metadata block (~16 KB), then disconnects.
 */
final class IcyMetadata {
    /** Thrown when the server doesn't support in-band metadata — stop polling it. */
    static final class Unsupported extends IOException {
        Unsupported() { super("no icy-metaint"); }
    }

    private IcyMetadata() {}

    static String fetchTitle(String url) throws IOException {
        String target = url;
        for (int redirect = 0; redirect < 4; redirect++) {
            URI uri = URI.create(target);
            boolean tls = "https".equalsIgnoreCase(uri.getScheme());
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : (tls ? 443 : 80);
            String path = (uri.getRawPath() == null || uri.getRawPath().isEmpty()) ? "/" : uri.getRawPath();
            if (uri.getRawQuery() != null) path += "?" + uri.getRawQuery();

            Socket socket = tls ? SSLSocketFactory.getDefault().createSocket() : new Socket();
            try {
                socket.connect(new InetSocketAddress(host, port), 8000);
                socket.setSoTimeout(8000);
                OutputStream out = socket.getOutputStream();
                String req = "GET " + path + " HTTP/1.0\r\n"
                    + "Host: " + host + (uri.getPort() > 0 ? ":" + port : "") + "\r\n"
                    + "Icy-MetaData: 1\r\n"
                    + "User-Agent: DoT/1.0 (Android)\r\n"
                    + "Accept: */*\r\n"
                    + "Connection: close\r\n\r\n";
                out.write(req.getBytes(StandardCharsets.US_ASCII));
                out.flush();

                InputStream in = new BufferedInputStream(socket.getInputStream(), 32 * 1024);
                String status = readLine(in);
                if (status == null) throw new IOException("empty response");
                int code = parseStatus(status);
                int metaint = -1;
                String location = null;
                String line;
                while ((line = readLine(in)) != null && !line.isEmpty()) {
                    int colon = line.indexOf(':');
                    if (colon <= 0) continue;
                    String name = line.substring(0, colon).trim().toLowerCase(Locale.ROOT);
                    String value = line.substring(colon + 1).trim();
                    if (name.equals("icy-metaint")) {
                        try { metaint = Integer.parseInt(value); } catch (NumberFormatException ignored) { }
                    } else if (name.equals("location")) {
                        location = value;
                    }
                }
                if (code >= 300 && code < 400 && location != null) {
                    target = uri.resolve(location).toString();
                    continue;
                }
                if (code >= 400) throw new IOException("HTTP " + code);
                if (metaint <= 0 || metaint > 1_000_000) throw new Unsupported();

                skipFully(in, metaint);
                int lenByte = in.read();
                if (lenByte < 0) throw new IOException("stream ended");
                int len = lenByte * 16;
                if (len == 0) return null; // no change announced in this block
                byte[] meta = readFully(in, len);
                return parseStreamTitle(decode(meta));
            } finally {
                try { socket.close(); } catch (IOException ignored) { }
            }
        }
        throw new IOException("too many redirects");
    }

    private static int parseStatus(String status) {
        // "HTTP/1.1 200 OK" or "ICY 200 OK"
        String[] parts = status.split(" ");
        if (parts.length < 2) return 0;
        try { return Integer.parseInt(parts[1]); } catch (NumberFormatException e) { return 0; }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream(128);
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') break;
            if (b != '\r') buf.write(b);
            if (buf.size() > 8192) throw new IOException("header too long");
        }
        if (b == -1 && buf.size() == 0) return null;
        return buf.toString("ISO-8859-1");
    }

    private static void skipFully(InputStream in, long n) throws IOException {
        while (n > 0) {
            long skipped = in.skip(n);
            if (skipped <= 0) {
                if (in.read() < 0) throw new IOException("stream ended");
                skipped = 1;
            }
            n -= skipped;
        }
    }

    private static byte[] readFully(InputStream in, int n) throws IOException {
        byte[] buf = new byte[n];
        int off = 0;
        while (off < n) {
            int r = in.read(buf, off, n - off);
            if (r < 0) throw new IOException("stream ended");
            off += r;
        }
        return buf;
    }

    /** UTF-8 when valid, otherwise Thai legacy encoding (TIS-620 / windows-874) used by many Thai servers. */
    private static String decode(byte[] bytes) {
        int end = bytes.length;
        while (end > 0 && bytes[end - 1] == 0) end--;
        ByteBuffer data = ByteBuffer.wrap(bytes, 0, end);
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(data).toString();
        } catch (CharacterCodingException e) {
            for (String name : new String[] {"x-windows-874", "windows-874", "TIS-620"}) {
                try {
                    return new String(bytes, 0, end, Charset.forName(name));
                } catch (Exception ignored) { }
            }
            return new String(bytes, 0, end, StandardCharsets.ISO_8859_1);
        }
    }

    static String parseStreamTitle(String meta) {
        String key = "StreamTitle='";
        int start = meta.indexOf(key);
        if (start < 0) return null;
        start += key.length();
        int end = meta.indexOf("';", start);
        if (end < 0) end = meta.lastIndexOf('\'');
        if (end < start) return null;
        String title = meta.substring(start, end).trim();
        if (title.isEmpty() || title.equals("-") || title.equals(" - ")) return null;
        return title;
    }
}
