// The one call that carries artwork bytes, MRMediaRemoteGetNowPlayingInfo(queue, block), wants a
// real Objective-C block; nothing inside /usr/bin/osascript can build one (docs/how-it-works.md).
// A block is ordinary compiled code, so this file — built by clang, not shipped — is loaded into
// /usr/bin/perl instead: since macOS 15.4 mediaremoted answers only a process whose own signing
// identifier starts with com.apple., and perl (com.apple.perl) qualifies same as osascript does,
// without osascript's arm64e requirement that turned away a plain dylib (AGENTS.md dead ends).
// The technique matches ungive/mediaremote-adapter (BSD-3-Clause), reimplemented from scratch and
// minimally: one function, artwork only, no argv or XS boilerplate — a zero-argument C function
// works as a Perl XSUB because dl_install_xsub calls it with extra arguments this one never reads.
#import <Foundation/Foundation.h>
#import <dispatch/dispatch.h>

#define NPS_ARTWORK_TIMEOUT_MS 2000

typedef void (^NPSNowPlayingInfoBlock)(NSDictionary *information);
typedef void (*NPSGetNowPlayingInfo)(dispatch_queue_t queue, NPSNowPlayingInfoBlock block);

void nps_get_artwork(void) {
    @autoreleasepool {
        NSString *outPath = NSProcessInfo.processInfo.environment[@"NPS_ARTWORK_OUT"];
        if (!outPath) {
            fprintf(stderr, "NPS_ARTWORK_OUT is not set\n");
            exit(1);
        }

        NSURL *frameworkURL = [NSURL fileURLWithPath:@"/System/Library/PrivateFrameworks/MediaRemote.framework"];
        CFBundleRef framework = CFBundleCreate(kCFAllocatorDefault, (__bridge CFURLRef)frameworkURL);
        NPSGetNowPlayingInfo getNowPlayingInfo = framework
            ? (NPSGetNowPlayingInfo)CFBundleGetFunctionPointerForName(framework, CFSTR("MRMediaRemoteGetNowPlayingInfo"))
            : NULL;
        if (!getNowPlayingInfo) {
            fprintf(stderr, "MRMediaRemoteGetNowPlayingInfo is not in this MediaRemote.framework\n");
            exit(1);
        }

        dispatch_queue_t queue = dispatch_queue_create("nowplayingseek.artwork", DISPATCH_QUEUE_SERIAL);
        dispatch_semaphore_t done = dispatch_semaphore_create(0);
        __block NSData *artworkData = nil;
        __block NSString *mimeType = nil;

        getNowPlayingInfo(queue, ^(NSDictionary *information) {
            id data = information[@"kMRMediaRemoteNowPlayingInfoArtworkData"];
            if ([data isKindOfClass:[NSData class]]) {
                artworkData = data;
            }
            id mime = information[@"kMRMediaRemoteNowPlayingInfoArtworkMIMEType"];
            if ([mime isKindOfClass:[NSString class]]) {
                mimeType = mime;
            }
            dispatch_semaphore_signal(done);
        });

        dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, NPS_ARTWORK_TIMEOUT_MS * NSEC_PER_MSEC));

        if (!artworkData.length) {
            printf("NO_ARTWORK\n");
            return;
        }

        NSError *error = nil;
        if (![artworkData writeToFile:outPath options:NSDataWritingAtomic error:&error]) {
            fprintf(stderr, "%s\n", error.localizedDescription.UTF8String);
            exit(1);
        }
        printf("%s\n", mimeType ? mimeType.UTF8String : "");
    }
}
