import { format, TextEncoder } from "util";
import { expect } from "chai";
import { NetLinkSocketUDP } from "../lib";
import { badArg, permutations, TesterUDP } from "./utils";

const validConstructorArgs = permutations(
    [60_600, undefined],
    ["", undefined],
    ["IPv4", "IPv6", undefined] as const,
);

const invalidConstructorArgs = permutations(
    [60_600, badArg<number>()],
    ["*", badArg<string>()],
    ["IPv4", badArg<"IPv6">()] as const,
    // remove the permutation with no symbols, as it is actually valid
).filter((args) => args.find((arg) => typeof arg === "symbol"));

describe("UDP client specific functionality", function () {
    const testing = new TesterUDP(this);

    describe("can be constructed with optional args", function () {
        for (const [portFrom, hostFrom, ipVersion] of validConstructorArgs) {
            const pretty = format({ hostFrom, portFrom, ipVersion });

            it(`can be constructed with ${pretty}`, async function () {
                const sibling = testing.netLink;

                if (portFrom) {
                    expect(portFrom).not.to.equal(sibling.portFrom);
                }

                const udp = new NetLinkSocketUDP(
                    portFrom,
                    hostFrom,
                    ipVersion,
                );

                if (portFrom) {
                    expect(udp.portFrom).to.equal(portFrom);
                }
                if (typeof hostFrom === "string") {
                    expect(udp.hostFrom).to.equal(hostFrom);
                }
                expect(udp.isIPv4).to.equal(ipVersion !== "IPv6");
                expect(udp.isIPv6).to.equal(ipVersion === "IPv6");

                const onceSent = testing.echo.events.sentData.once();
                udp.sendTo(testing.host, testing.port, testing.str);
                const sent = await onceSent;

                if (portFrom) {
                    expect(sent.from.port).to.equal(portFrom);
                }
                expect(sent.str).to.equal(testing.str);
                udp.disconnect();
            });
        }
    });

    describe("cannot be constructed with invalid args", function () {
        for (const args of invalidConstructorArgs) {
            const pretty = args.map(String).join(", ");
            it(`cannot be constructed with [${pretty}]}`, function () {
                const create = () => new NetLinkSocketUDP(...args);
                expect(create).to.throw();
            });
        }
    });

    it("can receiveFrom other UDP sockets", async function () {
        const sentPromise = testing.echo.events.sentData.once();
        testing.netLink.sendTo(testing.host, testing.port, testing.str);
        void (await sentPromise);
        const read = testing.netLink.receiveFrom();

        expect(read).to.exist;
        if (read) {
            expect(read.host).to.equal("127.0.0.1");
            expect(read.port).to.equal(testing.port);
            expect(read.data.toString()).to.equal(testing.str);
        } else {
            expect.fail("read should have existed");
        }
    });

    it("can receiveFrom nothing", function () {
        testing.netLink.isBlocking = false;
        const readFromNothing = testing.netLink.receiveFrom();
        expect(readFromNothing).to.be.undefined;
    });

    it("can sendTo other UDP sockets", async function () {
        const sentPromise = testing.echo.events.sentData.once();
        testing.netLink.sendTo(testing.host, testing.port, testing.str);
        const sent = await sentPromise;

        expect(sent.from.port).to.equal(testing.netLink.portFrom);
        expect(sent.str).to.equal(testing.str);
    });

    it("can sendTo with Buffers", async function () {
        const sentPromise = testing.echo.events.sentData.once();
        const buffer = Buffer.from(testing.str);
        testing.netLink.sendTo(testing.host, testing.port, buffer);
        const sent = await sentPromise;

        expect(sent.buffer.compare(buffer)).to.equal(0);
    });

    it("can sendTo with Uint8Arrays", async function () {
        const sentPromise = testing.echo.events.sentData.once();
        const array = new TextEncoder().encode(testing.str);
        testing.netLink.sendTo(testing.host, testing.port, array);
        const sent = await sentPromise;

        expect(sent.str).to.equal(testing.str);
    });

    it("can sendTo nothing", function () {
        expect(() =>
            testing.netLink.sendTo(
                "192.0.2.0", // invalid via RFC 5737
                1234,
                "I scream into the void",
            ),
        ).not.to.throw();
    });
});